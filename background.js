// Background/event page. Handles:
//   1. Asking Claude to extract case identifiers from the page text.
//   2. Querying CourtListener's search API with those identifiers.
//
// Everything here is plain fetch() — Firefox MV2 supports it in the
// background script, and CORS is not an issue because we declared
// api.anthropic.com and www.courtlistener.com in host permissions.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6"; // fallback when user hasn't picked a model in settings

// ---- Claude: extract case identifiers ------------------------------------

const EXTRACT_SYSTEM = `You identify U.S. court cases discussed in news articles, blog posts, or other web pages.

Given the page text, output a SINGLE JSON object (no prose, no code fences) with these fields:

{
  "is_case": boolean,          // true if the page discusses a specific, identifiable court case
  "confidence": "high" | "medium" | "low",
  "case_name": string | null,  // Short CourtListener-style caption: "Loomer v. Maher", NOT "Loomer v. Maher and HBO". Use the two lead parties. If only one side is named, that's fine ("United States v. Smith"). When a government sues a government (U.S. v. a state, state v. U.S., one state v. another), use the entity name, NOT an individual official — "United States v. State of New Jersey", not "United States v. Sherrill" even if Governor Sherrill is a named co-defendant. Your best guess is better than null.
  "parties": string[] | null,  // all named parties: ["Laura Loomer", "Bill Maher", "HBO"]
  "court": string | null,      // human form: "M.D. Fla.", "S.D.N.Y.", "9th Cir.", "SCOTUS"
  "court_id": string | null,   // CourtListener court id, ONLY if you're confident. Leave null if unsure — a wrong court_id produces zero results. Examples: "flmd" (M.D. Fla.), "nysd" (S.D.N.Y.), "cacd" (C.D. Cal.), "ca9" (9th Cir.), "scotus" (SCOTUS).
  "docket_number": string | null, // e.g. "5:24-cv-00625" or "23-1234"
  "citation": string | null,   // reporter citation like "600 U.S. 123" if given
  "date_filed_year": number | null,
  "date_decided": string | null, // YYYY-MM-DD if the page states a ruling date
  "judge": string | null,
  "document_type": "opinion" | "docket" | "complaint" | "order" | "unknown",
  //   Key signal — use this rule:
  //   - "opinion" ONLY for appellate or supreme-court published opinions (SCOTUS, circuit courts, state supreme courts).
  //   - "docket" / "order" / "complaint" for anything at a DISTRICT COURT or TRIAL level — including summary judgment rulings, orders, filings, and news stories about active litigation. If the judge is a district judge, it's NOT "opinion".
  //   - "unknown" if you really can't tell.
  //   This controls which CourtListener index is searched (RECAP vs. Opinions), so get it right.
  "query_hints": string[]      // 2-4 short strings you'd type into a legal search box to find this case
}

If the page isn't about a specific case (e.g. a general news roundup, an opinion piece about the law in general, a marketing page), set is_case=false and leave other fields null.

FOCUS PASSAGE: If the user message contains a "FOCUS PASSAGE" section in addition to "PAGE TEXT", the user has highlighted the specific passage they want resolved. The page may discuss multiple cases or orders; your job is to identify the ONE case the focus passage is about, not the page's most prominent case. Use the rest of the page as context to fill in details the focus passage leaves out (docket number, court, exact caption), but the case you identify must be the one the focus is describing. If the focus passage describes a different case than the page's main subject, go with the focus.

Output ONLY the JSON object.`;

async function extractCaseInfo({ apiKey, model, title, url, text, selection }) {
  // If the user selected text, it becomes the focus passage. The rest of
  // the page still goes in as context — Claude uses it for disambiguation
  // (docket numbers, court ids, exact captions the selection might lack),
  // but the identified case must be the one the selection describes.
  const userContent = selection
    ? `URL: ${url}
Title: ${title}

FOCUS PASSAGE (user-selected — identify THIS case):
${selection}

PAGE TEXT (context only):
${text}`
    : `URL: ${url}
Title: ${title}

PAGE TEXT:
${text}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required for direct browser calls to the Anthropic API.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: EXTRACT_SYSTEM,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const textOut = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Defensive: strip code fences if the model added any despite instructions.
  const cleaned = textOut.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Claude returned non-JSON: ${textOut.slice(0, 200)}`);
  }
}

// ---- CourtListener: search ------------------------------------------------

async function fetchCLSearch(url) {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function searchCourtListener(info) {
  // Try the planned (type, strategy) URLs in order until one returns results.
  // The ordering/dedup logic lives in buildSearchPlan (pure, unit-tested);
  // this function is just the I/O loop. `tried` counts URLs actually fetched,
  // matching the old triedURLs.length the popup renders ("across N tries").
  const plan = buildSearchPlan(info);
  let tried = 0;
  for (const { type, strategy, url } of plan) {
    tried++;
    const data = await fetchCLSearch(url);
    if (data && data.results && data.results.length > 0) {
      // Re-rank RECAP by year proximity (skip for opinions — old opinions are
      // routinely discussed in articles long after they come down).
      const ranked =
        type === "r" ? rerankByDate(data.results, info.date_filed_year) : data.results;
      return { type, strategy, results: ranked.slice(0, 5), query_url: url, tried };
    }
  }
  return { type: null, strategy: null, results: [], query_url: null, tried };
}

// ---- Context menu: "Find on CourtListener" on selected text --------------
//
// Why: Firefox's built-in PDF viewer doesn't expose selections to content
// scripts (the viewer renders in a chrome-privileged document), so the
// toolbar button can't see what the user highlighted in a PDF. But the
// contextMenus API DOES surface `info.selectionText` from the PDF viewer,
// so a right-click menu is the one path that works inside PDFs without
// bundling pdf.js. Stash the selection in storage and pop the popup;
// popup.js picks it up and runs the same Claude → CourtListener flow on
// just the selection (no GRAB_PAGE).

const MENU_ID = "find-on-courtlistener";

browser.runtime.onInstalled.addListener(() => {
  // removeAll first so reinstall/upgrade can't produce duplicates.
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: "Find on CourtListener",
      contexts: ["selection"],
    });
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!info.selectionText) return;
  await browser.storage.local.set({
    pendingSelection: {
      selection: info.selectionText,
      sourceURL: (tab && tab.url) || info.pageUrl || "",
      sourceTitle: (tab && tab.title) || "",
      ts: Date.now(),
    },
  });
  try {
    await browser.browserAction.openPopup();
  } catch (e) {
    // openPopup can fail in rare cases (e.g., focus stolen by another
    // window). The pendingSelection is still in storage — if the user
    // clicks the toolbar button within 30s, the popup will pick it up.
    console.warn("openPopup failed; user can click the toolbar icon:", e);
  }
});

// ---- Message handler ------------------------------------------------------

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg && msg.type === "FIND_CASE") {
    try {
      const { apiKey, model } = await browser.storage.local.get(["apiKey", "model"]);
      if (!apiKey) {
        return { ok: false, error: "no_api_key" };
      }
      const info = await extractCaseInfo({
        apiKey,
        model: model || DEFAULT_MODEL,
        title: msg.title,
        url: msg.url,
        text: msg.text,
        selection: msg.selection || "",
      });
      // Echo back whether a selection drove the extraction so the popup
      // can show a small affordance.
      info._used_selection = Boolean(msg.selection);
      if (!info.is_case) {
        return { ok: true, info, search: null, note: "no_case_detected" };
      }
      const search = await searchCourtListener(info);
      return { ok: true, info, search };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }
});
