// Pure CourtListener query construction, factored out of background.js so it
// can be unit-tested under Node (node --test) without the browser or network.
//
// Dual-mode: in the extension this loads as a classic background script (its
// top-level `const`/`function` declarations join the shared background global
// scope, so background.js — loaded AFTER this file — can call them directly).
// Under Node the `module.exports` block at the bottom makes the same functions
// require()-able. The `module` guard is never truthy in the browser.

const CL_BASE = "https://www.courtlistener.com";

function buildCLSearchURL(info, type, strategy = "strict") {
  // type: "o" (opinions) or "r" (RECAP dockets)
  // strategy:
  //   "strict"             — case_name + court + docket + citation
  //   "loose"              — drop the court filter (in case court_id is wrong)
  //   "appellate_freetext" — opinions only: free-text q from parties +
  //                          query_hints, plus court and date filters.
  //                          Catches consolidated cases where the appellate
  //                          caption differs from the article's framing
  //                          (e.g., "Las Americas v. Paxton" → "United
  //                          States v. State of Texas" on appeal).
  //   "free"               — free-text q= only, last-ditch
  // Returns null when the strategy has no useful query to build (caller
  // skips null URLs).
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

  if (strategy === "appellate_freetext") {
    const queryParts = [];
    if (info.parties && info.parties.length > 0) queryParts.push(...info.parties.slice(0, 4));
    if (info.query_hints && info.query_hints.length > 0) queryParts.push(...info.query_hints.slice(0, 2));
    if (queryParts.length === 0 && info.case_name) queryParts.push(info.case_name);
    if (queryParts.length === 0) return null;
    params.set("q", queryParts.join(" "));
    if (info.court_id) params.set("court", info.court_id);
    // Date filter: prefer the explicit decision date (tight window),
    // else fall back to the year hint (looser).
    if (info.date_decided) {
      const d = new Date(info.date_decided);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() - 30);
        params.set("filed_after", d.toISOString().slice(0, 10));
      }
    } else if (info.date_filed_year) {
      params.set("filed_after", `${info.date_filed_year - 1}-01-01`);
    }
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

function buildSearchPlan(info) {
  // Pure planning step extracted from searchCourtListener. Returns the ordered,
  // de-duplicated list of { type, strategy, url } the caller should try in
  // order until one returns results.
  //
  // type order: RECAP-first when Claude flagged a trial-court matter (or a
  // docket number is present), opinions-first otherwise.
  // strategy axis within each type: strict (court filter) → loose (no court
  // filter, in case court_id was guessed wrong) → free-text last-ditch; plus an
  // opinions-only appellate free-text pass for consolidated-caption cases.
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
    if (t === "o") {
      attempts.push({ type: "o", strategy: "appellate_freetext" });
    }
  }
  attempts.push({ type: "r", strategy: "free" });
  attempts.push({ type: "o", strategy: "free" });

  // Build URLs, skipping strategies that produced nothing useful, and dedup
  // identical URLs (strict/loose collapse when court_id is null).
  const seen = new Set();
  const plan = [];
  for (const { type, strategy } of attempts) {
    const url = buildCLSearchURL(info, type, strategy);
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    plan.push({ type, strategy, url });
  }
  return plan;
}

function rerankByDate(results, year) {
  // Why: CourtListener's BM25 ranks by text relevance, so an old docket with
  // a similar caption and lots of activity can outrank the newly-filed case
  // an article is actually about. Re-rank by year proximity to the article's
  // hint, breaking ties with original BM25 order. Cases at or after the
  // article's year are preferred (suits get coverage near filing); older
  // cases get a per-year-distance penalty. Pure re-rank, no exclusion — if
  // the hint is wrong we degrade to the original order rather than miss.
  if (!year || !Array.isArray(results) || results.length < 2) return results;
  const scored = results.map((r, i) => {
    const filedYear = r.dateFiled ? parseInt(r.dateFiled.slice(0, 4), 10) : null;
    let distance;
    if (filedYear === null || Number.isNaN(filedYear)) {
      distance = Number.POSITIVE_INFINITY;
    } else if (filedYear >= year) {
      distance = filedYear - year;
    } else {
      distance = (year - filedYear) * 2 + 0.5;
    }
    return { r, distance, originalIndex: i };
  });
  scored.sort((a, b) => a.distance - b.distance || a.originalIndex - b.originalIndex);
  return scored.map((s) => s.r);
}

// Node-only: expose the helpers to the test runner. Never truthy in the browser.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CL_BASE, buildCLSearchURL, buildSearchPlan, rerankByDate };
}
