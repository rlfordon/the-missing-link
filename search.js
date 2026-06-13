// Pure CourtListener query construction, factored out of background.js so it
// can be unit-tested under Node (node --test) without the browser or network.
//
// Dual-mode: in the extension this loads as a classic background script (its
// top-level `const`/`function` declarations join the shared background global
// scope, so background.js — loaded AFTER this file — can call them directly).
// Under Node the `module.exports` block at the bottom makes the same functions
// require()-able. The `module` guard is never truthy in the browser.

const CL_BASE = "https://www.courtlistener.com";
const INITIALISM_STOPWORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or",
  "re", "the", "to", "v", "vs",
]);
const TOKEN_STOPWORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or",
  "re", "the", "to", "v", "vs",
  "co", "company", "corp", "corporation", "inc", "llc", "lp", "ltd",
]);

function cleanPartyNameForRecap(party) {
  if (!party) return "";
  return party
    .replace(/\bet al\.?\b.*$/i, "")
    .replace(/\bd\/b\/a\b.*$/i, "")
    .replace(/\bdoing business as\b.*$/i, "")
    .replace(/\ba\/k\/a\b.*$/i, "")
    .replace(/\bf\/k\/a\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:]+$/g, "")
    .trim();
}

function looksGovernmentOrAcronymParty(party) {
  if (!party) return false;
  const compact = party.replace(/[.\s]/g, "");
  if (/^[A-Z]{2,8}$/.test(compact)) return true;
  return /\b(eeoc|equal employment opportunity commission|united states|u\.?s\.?|department|commission|board|secretary|agency|state of|commonwealth of|city of|county of)\b/i
    .test(party);
}

function normalizeWhitespace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function normalizeTextForTokens(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenizeInformativeText(text) {
  return normalizeTextForTokens(text)
    .split(/\s+/)
    .filter((token) => token && !TOKEN_STOPWORDS.has(token) && token.length >= 2);
}

function buildInitialism(text) {
  const words = normalizeTextForTokens(text)
    .split(/\s+/)
    .filter((token) => token && !INITIALISM_STOPWORDS.has(token) && /^[a-z]/.test(token) && token.length >= 2);
  if (words.length < 2) return "";
  const acronym = words.map((token) => token[0]).join("");
  return acronym.length >= 2 && acronym.length <= 8 ? acronym : "";
}

function tokensForPhrase(text) {
  const tokens = new Set(tokenizeInformativeText(text));
  const compact = String(text || "").replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  if (/^[a-z]{2,8}$/.test(compact)) tokens.add(compact);
  const acronym = buildInitialism(text);
  if (acronym) tokens.add(acronym);
  return tokens;
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const text = normalizeWhitespace(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function getExpansionCandidates(info) {
  return uniqueStrings([
    ...(info.parties || []),
    ...(info.query_hints || []),
  ]);
}

function expandAcronymParty(party, info) {
  const text = normalizeWhitespace(party);
  const compact = text.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  if (!/^[a-z]{2,8}$/.test(compact)) return text;

  for (const candidate of getExpansionCandidates(info)) {
    if (candidate.toLowerCase() === text.toLowerCase()) continue;
    if (buildInitialism(candidate) === compact) return candidate;
  }
  return text;
}

function getExpandedCaseName(info) {
  if (!info.case_name) return null;
  const m = info.case_name.match(/^(.+?)\s+v\.?\s+(.+)$/i);
  if (!m) return normalizeWhitespace(info.case_name);
  const lhs = expandAcronymParty(m[1], info);
  const rhs = expandAcronymParty(m[2], info);
  return `${lhs} v. ${rhs}`;
}

function getStructuredCaseName(info, type) {
  const expandedCaseName = getExpandedCaseName(info);
  if (!expandedCaseName) return null;
  if (type !== "r") return expandedCaseName;

  const m = expandedCaseName.match(/^(.+?)\s+v\.?\s+(.+)$/i);
  if (!m) return expandedCaseName;

  const lhs = m[1].trim();
  const rhs = m[2].trim();
  const cleanedRhs = cleanPartyNameForRecap(rhs);
  const rhsTokenCount = cleanedRhs.split(/\s+/).filter(Boolean).length;
  const hadAliasTail =
    /\bd\/b\/a\b|\bdoing business as\b|\ba\/k\/a\b|\bf\/k\/a\b/i.test(rhs);

  if (cleanedRhs && rhsTokenCount >= 3 && (hadAliasTail || looksGovernmentOrAcronymParty(lhs))) {
    return cleanedRhs;
  }

  return expandedCaseName;
}

function buildFreeTextQuery(info) {
  return uniqueStrings([
    getExpandedCaseName(info),
    info.case_name,
    info.docket_number,
    info.citation,
    ...(info.query_hints || []).slice(0, 3),
    ...(info.parties || []).slice(0, 4),
    info.court,
  ]).join(" ");
}

function buildCaseNameFreeTextQuery(info) {
  return uniqueStrings([
    getExpandedCaseName(info),
    info.case_name,
  ]).join(" ");
}

function splitOriginalWords(text) {
  return normalizeWhitespace(text).split(/\s+/).filter(Boolean);
}

function cleanPhraseWord(word) {
  return word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
}

function isPhraseWord(word) {
  return /^[A-Z0-9]/.test(word);
}

function extractCapitalizedPhrases(text) {
  const words = splitOriginalWords(text);
  const phrases = [];
  let current = [];
  const connectors = new Set(["of", "the", "for", "to", "de"]);

  function flush() {
    if (current.length === 0) return;
    const phrase = current.join(" ").trim();
    if (phrase && phrase.length >= 3) phrases.push(phrase);
    current = [];
  }

  for (const rawWord of words) {
    const word = cleanPhraseWord(rawWord);
    if (!word) {
      flush();
      continue;
    }
    const lower = word.toLowerCase();
    if (isPhraseWord(word)) {
      current.push(word);
      continue;
    }
    if (current.length > 0 && connectors.has(lower)) {
      current.push(lower);
      continue;
    }
    flush();
  }
  flush();

  return uniqueStrings(phrases).filter((phrase) => !/^(The|A|An)$/.test(phrase));
}

function buildSourceTextQuery(context = {}) {
  const titleTokens = tokenizeInformativeText(context.title || "").slice(0, 6);
  const phrases = uniqueStrings([
    ...extractCapitalizedPhrases(context.selection || ""),
    ...extractCapitalizedPhrases(context.title || ""),
  ]).slice(0, 8);
  const tokenTail = uniqueStrings(titleTokens).slice(0, 4);
  return uniqueStrings([...phrases, ...tokenTail]).join(" ");
}

function normalizedPhraseKey(text) {
  return normalizeTextForTokens(text).replace(/\s+/g, " ").trim();
}

function resultTextFields(result) {
  return [
    result.caseName,
    result.case_name_full,
    ...(Array.isArray(result.party) ? result.party : []),
  ]
    .map((value) => normalizedPhraseKey(value))
    .filter(Boolean);
}

function scorePhraseHits(result, context = {}) {
  const phrases = uniqueStrings([
    ...extractCapitalizedPhrases(context.selection || ""),
    ...extractCapitalizedPhrases(context.title || ""),
  ])
    .map((phrase) => normalizedPhraseKey(phrase))
    .filter(Boolean);
  if (phrases.length === 0) return 0;

  const fields = resultTextFields(result);
  let hits = 0;
  for (const phrase of phrases) {
    if (phrase.length < 3) continue;
    if (fields.some((field) => field.includes(phrase))) hits++;
  }
  return hits;
}

function exactCaseNameKey(name) {
  return normalizeTextForTokens(name).replace(/\s+/g, " ").trim();
}

function getDateDistance(dateFiled, year) {
  if (!year) return Number.POSITIVE_INFINITY;
  const filedYear = dateFiled ? parseInt(dateFiled.slice(0, 4), 10) : null;
  if (filedYear === null || Number.isNaN(filedYear)) return Number.POSITIVE_INFINITY;
  if (filedYear >= year) return filedYear - year;
  return (year - filedYear) * 2 + 0.5;
}

function buildSignalWeights(info) {
  const weights = new Map();
  const addTokens = (texts, weight) => {
    for (const text of texts) {
      for (const token of tokensForPhrase(text)) {
        weights.set(token, (weights.get(token) || 0) + weight);
      }
    }
  };

  const expandedCaseName = getExpandedCaseName(info);
  if (expandedCaseName) addTokens([expandedCaseName], 4);
  if (info.case_name && info.case_name !== expandedCaseName) addTokens([info.case_name], 3);
  addTokens((info.parties || []).slice(0, 4), 2);
  addTokens((info.query_hints || []).slice(0, 3), 1);
  return weights;
}

function scoreResultMatch(result, info) {
  const weights = buildSignalWeights(info);
  const resultTokens = tokensForPhrase(result.caseName || result.case_name_full || "");
  let score = 0;
  for (const token of resultTokens) {
    score += weights.get(token) || 0;
  }

  const expandedCaseName = getExpandedCaseName(info);
  if (expandedCaseName && exactCaseNameKey(result.caseName) === exactCaseNameKey(expandedCaseName)) {
    score += 12;
  }
  if (info.docket_number && result.docketNumber === info.docket_number) {
    score += 20;
  }
  if (info.court && result.court_citation_string) {
    const want = normalizeTextForTokens(info.court);
    const got = normalizeTextForTokens(result.court_citation_string);
    if (want && got && (want.includes(got) || got.includes(want))) {
      score += 2;
    }
  }
  return score;
}

function scoreSourceOverlap(result, context = {}) {
  const sourceQuery = buildSourceTextQuery(context);
  if (!sourceQuery) return 0;
  const sourceTokens = new Set(tokenizeInformativeText(sourceQuery));
  const resultTokens = new Set();
  for (const field of resultTextFields(result)) {
    for (const token of tokenizeInformativeText(field)) resultTokens.add(token);
  }
  let overlap = 0;
  for (const token of resultTokens) {
    if (sourceTokens.has(token)) overlap++;
  }
  return overlap;
}

function isPlausibleMatch(result, info, context = {}) {
  if (!result) return false;
  if (info.docket_number && result.docketNumber === info.docket_number) return true;
  const matchScore = scoreResultMatch(result, info);
  const phraseHits = scorePhraseHits(result, context);
  if (phraseHits >= 2) return true;
  if (matchScore >= 8) return true;
  const overlap = scoreSourceOverlap(result, context);
  if (overlap >= 2) return true;
  if (overlap >= 1 && matchScore >= 2) return true;
  return false;
}

function rankSearchResults(results, info, context = {}) {
  if (!Array.isArray(results) || results.length < 2) return results;
  const ranked = results.map((result, originalIndex) => ({
    result,
    originalIndex,
    phraseHits: scorePhraseHits(result, context),
    matchScore: scoreResultMatch(result, info),
    sourceOverlap: scoreSourceOverlap(result, context),
    dateDistance: getDateDistance(result.dateFiled, info.date_filed_year),
  }));
  ranked.sort((a, b) =>
    b.phraseHits - a.phraseHits ||
    b.sourceOverlap - a.sourceOverlap ||
    b.matchScore - a.matchScore ||
    a.dateDistance - b.dateDistance ||
    a.originalIndex - b.originalIndex
  );
  return ranked.map((item) => item.result);
}

function buildSourceSearchURL(context, type) {
  const q = buildSourceTextQuery(context);
  if (!q) return null;
  const params = new URLSearchParams();
  params.set("type", type);
  params.set("order_by", "score desc");
  params.set("q", q);
  return `${CL_BASE}/api/rest/v4/search/?${params.toString()}`;
}

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
    const q = buildFreeTextQuery(info);
    if (q) params.set("q", q);
    return `${CL_BASE}/api/rest/v4/search/?${params.toString()}`;
  }

  if (strategy === "case_name_free") {
    const q = buildCaseNameFreeTextQuery(info);
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

  const structuredCaseName = getStructuredCaseName(info, type);
  if (structuredCaseName) params.set("case_name", structuredCaseName);
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
    attempts.push({ type: t, strategy: "case_name_free" });
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
    return { r, distance: getDateDistance(r.dateFiled, year), originalIndex: i };
  });
  scored.sort((a, b) => a.distance - b.distance || a.originalIndex - b.originalIndex);
  return scored.map((s) => s.r);
}

// Node-only: expose the helpers to the test runner. Never truthy in the browser.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CL_BASE,
    buildCLSearchURL,
    buildCaseNameFreeTextQuery,
    buildFreeTextQuery,
    buildSourceSearchURL,
    buildSearchPlan,
    getExpandedCaseName,
    isPlausibleMatch,
    rankSearchResults,
    rerankByDate,
    scorePhraseHits,
    scoreSourceOverlap,
  };
}
