// Background/event page. Handles:
//   1. Asking Claude to extract case identifiers from the page text.
//   2. Querying CourtListener's search API with those identifiers.
//
// Everything here is plain fetch() — Firefox MV2 supports it in the
// background script, and CORS is not an issue because we declared
// api.anthropic.com and www.courtlistener.com in host permissions.

const CL_BASE = "https://www.courtlistener.com";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6"; // mid-tier: better disambiguation than Haiku, cheaper than Opus

// ---- Claude: extract case identifiers ------------------------------------

const EXTRACT_SYSTEM = `You identify U.S. court cases discussed in news articles, blog posts, or other web pages.

Given the page text, output a SINGLE JSON object (no prose, no code fences) with these fields:

{
  "is_case": boolean,          // true if the page discusses a specific, identifiable court case
  "confidence": "high" | "medium" | "low",
  "case_name": string | null,  // Short CourtListener-style caption: "Loomer v. Maher", NOT "Loomer v. Maher and HBO". Use the two lead parties. If only one side is named, that's fine ("United States v. Smith"). Your best guess is better than null.
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

async function extractCaseInfo({ apiKey, title, url, text, selection }) {
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
      model: CLAUDE_MODEL,
      max_tokens: 800,
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

function buildCLSearchURL(info, type) {
  // type: "o" (opinions) or "r" (RECAP dockets)
  const params = new URLSearchParams();
  params.set("type", type);
  params.set("order_by", "score desc");

  if (info.case_name) params.set("case_name", info.case_name);
  if (info.docket_number) params.set("docket_number", info.docket_number);
  if (info.court_id) params.set("court", info.court_id);
  if (info.citation && type === "o") params.set("citation", info.citation);

  // Fallback q if we have nothing structured.
  if (!info.case_name && !info.docket_number && !info.citation) {
    const q = (info.query_hints && info.query_hints[0]) || (info.parties || []).join(" ");
    if (q) params.set("q", q);
  }
  return `${CL_BASE}/api/rest/v4/search/?${params.toString()}`;
}

function buildCLSearchURL(info, type, strategy = "strict") {
  // type: "o" (opinions) or "r" (RECAP dockets)
  // strategy:
  //   "strict"  — use everything we have: case_name + court + docket + citation
  //   "loose"   — drop the court filter (in case Claude guessed a wrong court id)
  //   "free"    — free-text q= only, last-ditch
  const params = new URLSearchParams();
  params.set("type", type);
  params.set("order_by", "score desc");

  if (strategy === "free") {
    const q =
      info.case_name ||
      (info.query_hints && info.query_hints[0]) ||
      (info.parties || []).join(" ");
    if (q) params.set("q", q);
    return `${CL_BASE}/api/rest/v4/search/?${params.toString()}`;
  }

  if (info.case_name) params.set("case_name", info.case_name);
  if (info.docket_number) params.set("docket_number", info.docket_number);
  if (strategy === "strict" && info.court_id) params.set("court", info.court_id);
  if (info.citation && type === "o") params.set("citation", info.citation);

  // If nothing structured landed in params beyond type/order_by, fall back to q.
  const keys = [...params.keys()];
  if (!keys.includes("case_name") && !keys.includes("docket_number") && !keys.includes("citation")) {
    const q = (info.query_hints && info.query_hints[0]) || (info.parties || []).join(" ");
    if (q) params.set("q", q);
  }
  return `${CL_BASE}/api/rest/v4/search/?${params.toString()}`;
}

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
  // Strategy: try a cascade of (type, strategy) pairs until something comes
  // back. News articles about trial-court matters live in RECAP; appellate
  // and SCOTUS opinions live in Opinions. We don't know which this is
  // without a confident signal, so we try both — but we let Claude's
  // `document_type` hint nudge the order.
  //
  // The `strict → loose → free` axis is separate: within each type, try
  // with the court filter first (most precise), then without (in case the
  // court_id was guessed wrong), then fall back to free-text.

  const prefersRecap =
    info.document_type === "docket" ||
    info.document_type === "order" ||
    info.document_type === "complaint" ||
    Boolean(info.docket_number);
  const typeOrder = prefersRecap ? ["r", "o"] : ["o", "r"];

  const attempts = [];
  for (const t of typeOrder) {
    for (const s of ["strict", "loose"]) {
      attempts.push({ type: t, strategy: s });
    }
  }
  // Final last-ditch attempt: free-text, RECAP first (broader coverage).
  attempts.push({ type: "r", strategy: "free" });
  attempts.push({ type: "o", strategy: "free" });

  const triedURLs = [];
  for (const { type, strategy } of attempts) {
    const url = buildCLSearchURL(info, type, strategy);
    // Don't repeat identical URLs (can happen when court_id is null — strict
    // and loose produce the same query).
    if (triedURLs.includes(url)) continue;
    triedURLs.push(url);
    const data = await fetchCLSearch(url);
    if (data && data.results && data.results.length > 0) {
      return {
        type,
        strategy,
        results: data.results.slice(0, 5),
        query_url: url,
        tried: triedURLs.length,
      };
    }
  }
  return { type: null, strategy: null, results: [], query_url: null, tried: triedURLs.length };
}

// ---- Message handler ------------------------------------------------------

browser.runtime.onMessage.addListener(async (msg) => {
  if (msg && msg.type === "FIND_CASE") {
    try {
      const { apiKey } = await browser.storage.local.get("apiKey");
      if (!apiKey) {
        return { ok: false, error: "no_api_key" };
      }
      const info = await extractCaseInfo({
        apiKey,
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
