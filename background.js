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

Call the record_case_extraction tool exactly once with the identifiers you extract from the page text. Provide every field; use null where a value is genuinely unavailable.

ROUTING RULE (most consequential field): document_type controls which CourtListener index is searched (RECAP vs. Opinions), so get it right.
  - "opinion" ONLY for appellate or supreme-court published opinions (SCOTUS, circuit courts, state supreme courts).
  - "docket" / "order" / "complaint" for anything at a DISTRICT COURT or TRIAL level — including summary judgment rulings, orders, filings, and news stories about active litigation. If the judge is a district judge, it is NOT "opinion".
  - "unknown" if you genuinely can't tell.

If the page isn't about a specific case (a general news roundup, an opinion piece about the law in general, a marketing page), set is_case=false and leave the other fields null.
Also set is_case=false when the page is about policy, nominations, public health, or politics and only mentions litigation incidentally. Do not invent a case just because a public figure or surname on the page happens to appear in CourtListener.

NAME DISCIPLINE:
  - Use party names exactly as they appear on the page or as clearly-supported long-form expansions from the surrounding context.
  - Do NOT invent missing surnames, middle names, or extra parties.
  - If the page only gives a partial caption or only one side's names, that's fine: use the partial caption or null rather than hallucinating a fuller one.

PUBLIC-LAW / GOVERNMENT-ACTION CASES:
  - When plaintiffs challenge a government approval, permit, authorization, policy, or event, do not assume the defendant from the headline alone.
  - Prefer the parties explicitly named in the page text. Only infer an agency-style defendant when the page context clearly indicates the suit is against the agency or official that authorized the action.
  - Do not replace an explicitly named private defendant with a government entity, or vice versa, unless the article clearly supports that swap.
  - Use the full page context to identify the actual defendant when the focus passage only lists plaintiffs or describes the challenged action.

FOCUS PASSAGE: If the user message contains a "FOCUS PASSAGE" section in addition to "PAGE TEXT", the user has highlighted the specific passage they want resolved. The page may discuss multiple cases or orders; identify the ONE case the focus passage is about, not the page's most prominent case. Use the rest of the page as context to fill in details the focus passage leaves out (docket number, court, exact caption), but the case you identify must be the one the focus is describing. If the focus passage describes a different case than the page's main subject, go with the focus.`;

// Tool schema mirrors the old EXTRACT_SYSTEM JSON shape. Downstream code reads
// these field names as load-bearing (see CLAUDE.md). Forced tool use means the
// API returns this as a parsed object in a tool_use block — no text parsing,
// so malformed-JSON / unquoted-enum / code-fence failures are impossible.
const EXTRACT_TOOL = {
  name: "record_case_extraction",
  description: "Record the identifiers for the U.S. court case discussed on the page.",
  input_schema: {
    type: "object",
    properties: {
      is_case: { type: "boolean", description: "true if the page discusses a specific, identifiable court case" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      case_name: {
        type: ["string", "null"],
        description: "Short CourtListener-style caption: \"Loomer v. Maher\", NOT \"Loomer v. Maher and HBO\". Use the two lead parties. If only one side is named, that's fine (\"United States v. Smith\"). Use names that appear on the page or are clearly supported by surrounding context; do not invent missing surnames or fuller names. When a government sues a government (U.S. v. a state, state v. U.S., one state v. another), use the entity name, NOT an individual official — \"United States v. State of New Jersey\", not \"United States v. Sherrill\" even if Governor Sherrill is a named co-defendant. In suits challenging government authorization or policy, prefer the defendant actually supported by the page text; do not swap in a government entity or private beneficiary unless the article clearly points there. Your best supported guess is better than null.",
      },
      parties: {
        type: ["array", "null"],
        items: { type: "string" },
        description: "all named parties: [\"Laura Loomer\", \"Bill Maher\", \"HBO\"]",
      },
      court: { type: ["string", "null"], description: "human form: \"M.D. Fla.\", \"S.D.N.Y.\", \"9th Cir.\", \"SCOTUS\"" },
      court_id: {
        type: ["string", "null"],
        description: "CourtListener court id, ONLY if you're confident. Leave null if unsure — a wrong court_id produces zero results. Examples: \"flmd\" (M.D. Fla.), \"nysd\" (S.D.N.Y.), \"cacd\" (C.D. Cal.), \"ca9\" (9th Cir.), \"scotus\" (SCOTUS).",
      },
      docket_number: { type: ["string", "null"], description: "e.g. \"5:24-cv-00625\" or \"23-1234\"" },
      citation: { type: ["string", "null"], description: "reporter citation like \"600 U.S. 123\" if given" },
      date_filed_year: { type: ["number", "null"] },
      date_decided: { type: ["string", "null"], description: "YYYY-MM-DD if the page states a ruling date" },
      judge: { type: ["string", "null"] },
      document_type: {
        type: "string",
        enum: ["opinion", "docket", "complaint", "order", "unknown"],
        description: "\"opinion\" ONLY for appellate/supreme-court published opinions. District/trial-court anything (orders, summary judgment, filings, active-litigation news) is docket/order/complaint, NOT opinion. \"unknown\" if unsure. Controls RECAP-vs-Opinions routing.",
      },
      query_hints: {
        type: "array",
        items: { type: "string" },
        description: "2-4 short strings you'd type into a legal search box to find this case",
      },
    },
    required: [
      "is_case", "confidence", "case_name", "parties", "court", "court_id",
      "docket_number", "citation", "date_filed_year", "date_decided", "judge",
      "document_type", "query_hints",
    ],
  },
};

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
      tools: [EXTRACT_TOOL],
      // Force the model to answer via the tool. The result arrives as a parsed
      // object in a tool_use block — we never JSON.parse model text.
      tool_choice: { type: "tool", name: "record_case_extraction" },
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const toolUse = (data.content || []).find(
    (b) => b.type === "tool_use" && b.name === "record_case_extraction"
  );
  if (!toolUse || !toolUse.input) {
    throw new Error(
      `Claude did not return a record_case_extraction tool call (stop_reason=${data.stop_reason})`
    );
  }
  return toolUse.input;
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

async function searchCourtListener(info, context = {}) {
  // Try the planned (type, strategy) URLs in order until one returns results.
  // The ordering/dedup logic lives in buildSearchPlan (pure, unit-tested);
  // this function is just the I/O loop. `tried` counts URLs actually fetched,
  // matching the old triedURLs.length the popup renders ("across N tries").
  const plan = buildSearchPlan(info);
  const sourceFallbacks = [];
  const prefersRecap =
    info.document_type === "docket" ||
    info.document_type === "order" ||
    info.document_type === "complaint" ||
    Boolean(info.docket_number);
  const typeOrder = prefersRecap ? ["r", "o"] : ["o", "r"];
  for (const type of typeOrder) {
    const url = buildSourceSearchURL(context, type);
    if (url) sourceFallbacks.push({ type, strategy: "source_freetext", url });
  }
  let tried = 0;
  let bestRejected = null;
  const attempts = [...plan, ...sourceFallbacks];
  const seen = new Set();
  for (const { type, strategy, url } of attempts) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    tried++;
    const data = await fetchCLSearch(url);
    if (data && data.results && data.results.length > 0) {
      const ranked = rankSearchResults(data.results, info, context);
      if (isPlausibleMatch(ranked[0], info, context)) {
        return { type, strategy, results: ranked.slice(0, 5), query_url: url, tried };
      }
      if (!bestRejected) {
        bestRejected = { type, strategy, results: ranked.slice(0, 5), query_url: url, tried };
      }
    }
  }
  if (bestRejected) {
    return { ...bestRejected, results: [] };
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
    await browser.action.openPopup();
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
      const search = await searchCourtListener(info, {
        selection: msg.selection || "",
        title: msg.title || "",
      });
      return { ok: true, info, search };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }
});
