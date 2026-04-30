// Popup logic. When the popup opens we:
//   1. Get the active tab.
//   2. Ask the content script for the page text.
//   3. Send that to the background script, which calls Claude + CourtListener.
//   4. Render the top match.

const CL_BASE = "https://www.courtlistener.com";

const $ = (id) => document.getElementById(id);

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatCaption(name) {
  // "Loomer v. Maher" -> renders with italic "v."
  if (!name) return "Untitled";
  const m = name.match(/^(.+?)\s+v\.?\s+(.+)$/i);
  if (!m) return esc(name);
  return `${esc(m[1])} <span class="v">v.</span> ${esc(m[2])}`;
}

function setStatus(headline, sub) {
  $("headline").textContent = headline;
  $("sub").textContent = sub;
}

function showError(title, body, showSetup = false) {
  $("status").classList.add("hidden");
  $("result").classList.add("hidden");
  const err = $("error");
  err.classList.remove("hidden");
  err.innerHTML = `
    <p class="err-title">${esc(title)}</p>
    <p class="err-body">${body}</p>
    ${showSetup ? `<button class="setup-btn" id="openSetup">Open settings</button>` : ""}
  `;
  if (showSetup) {
    $("openSetup").addEventListener("click", () => browser.runtime.openOptionsPage());
  }
}

function renderResult(info, search) {
  $("status").classList.add("hidden");
  const box = $("result");
  box.classList.remove("hidden");

  if (!info.is_case || !search || !search.results || search.results.length === 0) {
    // No case detected, or no match found.
    const hint = info.case_name || (info.query_hints || [])[0] || info.parties?.join(" ");
    // If Claude flagged this as a trial-court matter, link RECAP first —
    // the Loomer-style footgun: opinions search won't find district-court
    // orders.
    const dt = info.document_type;
    const recapFirst = dt === "docket" || dt === "order" || dt === "complaint";
    const oURL = hint ? `${CL_BASE}/?q=${encodeURIComponent(hint)}&type=o` : `${CL_BASE}/`;
    const rURL = hint ? `${CL_BASE}/?q=${encodeURIComponent(hint)}&type=r` : `${CL_BASE}/`;
    const primary = recapFirst ? rURL : oURL;
    const primaryLabel = recapFirst ? "Search RECAP manually" : "Search opinions manually";
    const secondary = recapFirst ? oURL : rURL;
    const secondaryLabel = recapFirst ? "or search opinions →" : "or search RECAP →";

    box.innerHTML = `
      <p class="empty-title">${info.is_case ? "No match on CourtListener" : "No case detected"}</p>
      <p class="empty-body">${
        info.is_case
          ? `Claude identified a case but CourtListener search returned no results across ${search?.tried || 0} tries. The case may not be on the platform, or the identifiers may be too vague.`
          : "This page doesn't appear to discuss a specific court case. Try a news article or opinion piece."
      }</p>
      ${hint ? `<a class="primary-link" href="${esc(primary)}" target="_blank" rel="noopener">${primaryLabel}</a>
      <div class="secondary-links"><a href="${esc(secondary)}" target="_blank" rel="noopener">${secondaryLabel}</a></div>`
      : `<a class="primary-link" href="${esc(CL_BASE)}/" target="_blank" rel="noopener">Open CourtListener</a>`}
    `;
    return;
  }

  const top = search.results[0];
  const rest = search.results.slice(1, 4);

  // Build metadata row from whatever the result has.
  const metaBits = [];
  if (top.court_citation_string) metaBits.push(esc(top.court_citation_string));
  if (top.docketNumber) metaBits.push(esc(top.docketNumber));
  if (top.dateFiled) metaBits.push(`filed ${esc(top.dateFiled)}`);
  if (top.dateTerminated) metaBits.push(`terminated ${esc(top.dateTerminated)}`);
  if (top.assignedTo) metaBits.push(`Judge ${esc(top.assignedTo)}`);
  const metaHTML = metaBits.join(' <span class="dot">·</span> ');

  // Primary URL: prefer the most recent available RECAP document if we
  // searched RECAP, otherwise the opinion/docket page.
  let primaryURL = null;
  let primaryLabel = "Open on CourtListener";
  if (search.type === "r" && Array.isArray(top.recap_documents)) {
    // Find a document that's actually available.
    const avail = top.recap_documents
      .filter((d) => d.is_available)
      .sort((a, b) => (b.entry_date_filed || "").localeCompare(a.entry_date_filed || ""));
    if (avail.length > 0) {
      primaryURL = CL_BASE + avail[0].absolute_url;
      primaryLabel = `Open ${avail[0].short_description || "document"}`;
    }
  }
  if (!primaryURL && top.absolute_url) {
    primaryURL = CL_BASE + top.absolute_url;
  } else if (!primaryURL && top.docket_absolute_url) {
    primaryURL = CL_BASE + top.docket_absolute_url;
  }

  const docketURL = top.docket_absolute_url
    ? CL_BASE + top.docket_absolute_url
    : null;

  const confidence = (info.confidence || "low").toLowerCase();
  const chip = `<span class="chip ${esc(confidence)}">${esc(confidence)} confidence</span>`;

  const snippet = top.recap_documents?.[0]?.description || top.snippet || "";
  const snippetHTML = snippet
    ? `<p class="snippet">${esc(snippet.slice(0, 220))}${snippet.length > 220 ? "…" : ""}</p>`
    : "";

  let altHTML = "";
  if (rest.length > 0) {
    altHTML = `
      <div class="alt-list">
        <div class="alt-title">Other matches</div>
        ${rest.map((r) => `
          <a class="alt-item" href="${esc(CL_BASE + (r.absolute_url || r.docket_absolute_url || ""))}" target="_blank" rel="noopener">
            <div class="alt-name">${formatCaption(r.caseName)}</div>
            <div class="alt-meta">${esc(r.court_citation_string || "")}${r.docketNumber ? " · " + esc(r.docketNumber) : ""}${r.dateFiled ? " · " + esc(r.dateFiled) : ""}</div>
          </a>
        `).join("")}
      </div>
    `;
  }

  const focusBadge = info._used_selection
    ? `<div class="focus-badge">focused on your selection</div>`
    : "";

  box.innerHTML = `
    ${focusBadge}
    <h1 class="caption">${formatCaption(top.caseName)}</h1>
    <div class="meta">${metaHTML || "&nbsp;"} ${chip}</div>
    ${snippetHTML}
    <a class="primary-link" href="${esc(primaryURL || "#")}" target="_blank" rel="noopener">${esc(primaryLabel)}</a>
    <div class="secondary-links">
      ${primaryURL ? `<a href="#" class="copy-link" data-url="${esc(primaryURL)}">copy link</a>` : ""}
      ${docketURL && docketURL !== primaryURL ? `<a href="${esc(docketURL)}" target="_blank" rel="noopener">View full docket →</a>` : ""}
      ${search.query_url ? `<a href="${esc(search.query_url.replace("/api/rest/v4/search/", "/?"))}" target="_blank" rel="noopener">See all search results →</a>` : ""}
    </div>
    ${altHTML}
  `;

  // Wire up the copy-link affordance. Browser popups close on focus loss,
  // so we keep the click in-popup (preventDefault) and use the Clipboard
  // API to put the URL on the system clipboard, then flash a confirmation.
  const copyEl = box.querySelector(".copy-link");
  if (copyEl) {
    copyEl.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(copyEl.dataset.url);
        copyEl.textContent = "copied ✓";
        copyEl.classList.add("copied");
      } catch {
        copyEl.textContent = "couldn't copy";
      }
      setTimeout(() => {
        copyEl.textContent = "copy link";
        copyEl.classList.remove("copied");
      }, 1500);
    });
  }
}

async function run() {
  $("settings").addEventListener("click", () => browser.runtime.openOptionsPage());

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showError("No active tab", "Couldn't find a page to read.");
    return;
  }

  // Shortcut: a CourtListener RECAP PDF URL encodes the PACER court code
  // and PACER case ID — NOT CourtListener's internal docket pk. We have to
  // resolve the PACER case ID to a CL docket pk via the Search API.
  // Pattern: storage.courtlistener.com/recap/gov.uscourts.<court>.<pacer_case_id>/...
  const recapPdfMatch = (tab.url || "").match(
    /^https?:\/\/storage\.courtlistener\.com\/recap\/gov\.uscourts\.([^/.]+)\.(\d+)\//
  );
  if (recapPdfMatch) {
    const [, court, pacerCaseId] = recapPdfMatch;
    setStatus("Opening docket…", `${court} #${pacerCaseId}`);
    // Search API supports anonymous reads; the dockets endpoint requires auth.
    // q=pacer_case_id:<id> + court filter resolves the PACER ID to CL's pk.
    const apiURL =
      `${CL_BASE}/api/rest/v4/search/?type=r` +
      `&court=${encodeURIComponent(court)}` +
      `&q=${encodeURIComponent("pacer_case_id:" + pacerCaseId)}`;
    try {
      const res = await fetch(apiURL, { headers: { accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        const r = data.results && data.results[0];
        if (r && r.docket_id) {
          await browser.tabs.update(tab.id, { url: `${CL_BASE}/docket/${r.docket_id}/` });
          window.close();
          return;
        }
      }
    } catch (e) {
      // Fall through to error UI below.
    }
    showError(
      "Couldn't find the docket",
      `CourtListener returned no docket for <code>${esc(court)}</code> case <code>${esc(pacerCaseId)}</code>. The PDF may not be indexed in the search system.`
    );
    return;
  }

  // Pick up a pending selection deposited by the right-click context menu
  // (background.js writes this when the user picks "Find on CourtListener"
  // on a text selection — including selections inside Firefox's PDF
  // viewer, which content scripts can't reach).
  const stored = await browser.storage.local.get("pendingSelection");
  if (stored.pendingSelection) {
    await browser.storage.local.remove("pendingSelection");
  }
  const pending =
    stored.pendingSelection && Date.now() - stored.pendingSelection.ts < 30000
      ? stored.pendingSelection
      : null;

  // Check for API key.
  const { apiKey } = await browser.storage.local.get("apiKey");
  if (!apiKey) {
    showError(
      "Setup needed",
      "Add your Anthropic API key in settings to use this extension. The key stays in your browser and is only used for case identification.",
      true
    );
    return;
  }

  // Context-menu path: skip GRAB_PAGE and run the flow on just the
  // selection. The selection is the entire input here — there's no
  // surrounding page text we can reliably read (PDFs especially).
  if (pending) {
    const preview =
      pending.selection.length > 60
        ? pending.selection.slice(0, 60) + "…"
        : pending.selection;
    setStatus("Identifying the case…", `Selection: "${preview}"`);
    let response;
    try {
      response = await browser.runtime.sendMessage({
        type: "FIND_CASE",
        url: pending.sourceURL || tab.url || "",
        title: pending.sourceTitle || tab.title || "",
        text: pending.selection,
        selection: "",
      });
    } catch (e) {
      showError("Extension error", `<code>${esc(e.message || e)}</code>`);
      return;
    }
    handleFindCaseResponse(response, { fromSelection: true });
    return;
  }

  // Don't try to run on internal pages.
  if (/^(about:|moz-extension:|chrome:)/.test(tab.url || "")) {
    showError(
      "Can't read this page",
      "Browser internal pages are off-limits. Navigate to an article or web page and try again."
    );
    return;
  }

  setStatus("Reading page…", "Extracting visible text");

  let page;
  try {
    page = await browser.tabs.sendMessage(tab.id, { type: "GRAB_PAGE" });
  } catch (e) {
    // Content script might not be injected on pages the extension loaded
    // before (or on restricted pages).
    showError(
      "Couldn't read the page",
      `The content script didn't respond. Try reloading the page and clicking the extension again.<br><code>${esc(e.message || e)}</code>`
    );
    return;
  }

  if (!page || !page.text || page.text.length < 40) {
    showError("Page is empty", "No readable text was found on this page.");
    return;
  }

  // If the user had text selected, show that in the status so they know
  // we picked it up.
  const hasSelection = Boolean(page.selection);
  if (hasSelection) {
    const preview = page.selection.length > 60
      ? page.selection.slice(0, 60) + "…"
      : page.selection;
    setStatus("Identifying the case…", `Focused on: "${preview}"`);
  } else {
    setStatus("Identifying the case…", "Reading the whole page");
  }

  let response;
  try {
    response = await browser.runtime.sendMessage({
      type: "FIND_CASE",
      url: page.url,
      title: page.title,
      text: page.text,
      selection: page.selection || "",
    });
  } catch (e) {
    showError("Extension error", `<code>${esc(e.message || e)}</code>`);
    return;
  }

  handleFindCaseResponse(response);
}

function handleFindCaseResponse(response, { fromSelection } = {}) {
  if (!response) {
    showError("No response", "Background script didn't respond.");
    return;
  }
  if (!response.ok) {
    if (response.error === "no_api_key") {
      showError("Setup needed", "Add your Anthropic API key in settings.", true);
      return;
    }
    showError("Something went wrong", `<code>${esc(response.error)}</code>`);
    return;
  }
  // Context-menu path: the selection IS the input, so flag it for the
  // "focused on your selection" badge.
  if (fromSelection && response.info) {
    response.info._used_selection = true;
  }
  setStatus("Searching CourtListener…", "Looking for the matching case");
  renderResult(response.info, response.search);
}

run();
