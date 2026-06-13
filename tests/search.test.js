const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
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
  CL_BASE,
} = require("../search.js");

function paramsOf(url) {
  return new URL(url).searchParams;
}

// ---- buildCLSearchURL ----

test("strict uses case_name + court filter + docket", () => {
  const url = buildCLSearchURL(
    { case_name: "Loomer v. Maher", court_id: "nysd", docket_number: "1:24-cv-01" },
    "r",
    "strict"
  );
  const p = paramsOf(url);
  assert.equal(p.get("type"), "r");
  assert.equal(p.get("case_name"), "Loomer v. Maher");
  assert.equal(p.get("court"), "nysd");
  assert.equal(p.get("docket_number"), "1:24-cv-01");
});

test("RECAP structured search simplifies government-plaintiff captions to the defendant-side legal name", () => {
  const url = buildCLSearchURL(
    {
      case_name: "EEOC v. PT Administrative Services LLC d/b/a JAG Physical Therapy",
      docket_number: "1:25-cv-03615",
    },
    "r",
    "loose"
  );
  const p = paramsOf(url);
  assert.equal(p.get("case_name"), "PT Administrative Services LLC");
  assert.equal(p.get("docket_number"), "1:25-cv-03615");
});

test("RECAP structured search keeps ordinary captions intact", () => {
  const url = buildCLSearchURL(
    { case_name: "Loomer v. Maher", docket_number: "1:24-cv-01" },
    "r",
    "loose"
  );
  assert.equal(paramsOf(url).get("case_name"), "Loomer v. Maher");
});

test("structured search expands acronym parties when a long-form match is available", () => {
  const url = buildCLSearchURL(
    {
      case_name: "Trump v. BBC",
      parties: ["Donald Trump", "British Broadcasting Corporation"],
    },
    "r",
    "strict"
  );
  assert.equal(paramsOf(url).get("case_name"), "Trump v. British Broadcasting Corporation");
});

test("loose drops the court filter", () => {
  const info = { case_name: "Loomer v. Maher", court_id: "nysd" };
  assert.equal(paramsOf(buildCLSearchURL(info, "r", "loose")).has("court"), false);
  assert.equal(paramsOf(buildCLSearchURL(info, "r", "strict")).get("court"), "nysd");
});

test("citation is only applied to the opinions index", () => {
  const info = { case_name: "X v. Y", citation: "600 U.S. 123" };
  assert.equal(paramsOf(buildCLSearchURL(info, "o", "strict")).get("citation"), "600 U.S. 123");
  assert.equal(paramsOf(buildCLSearchURL(info, "r", "strict")).has("citation"), false);
});

test("free falls back to q= from case_name/hints/parties", () => {
  const p = paramsOf(buildCLSearchURL({ parties: ["Alice", "Bob"] }, "r", "free"));
  assert.equal(p.get("q"), "Alice Bob");
});

test("free query combines case name, hints, parties, and docket details", () => {
  const q = buildFreeTextQuery({
    case_name: "Trump v. BBC",
    parties: ["Donald Trump", "British Broadcasting Corporation"],
    query_hints: ["defamation", "$10 billion"],
    docket_number: "1:25-cv-25894",
  });
  assert.match(q, /Trump v\. British Broadcasting Corporation/);
  assert.match(q, /British Broadcasting Corporation/);
  assert.match(q, /defamation/);
  assert.match(q, /1:25-cv-25894/);
});

test("case-name free-text query uses the extracted caption only", () => {
  const q = buildCaseNameFreeTextQuery({
    case_name: "Douglas v. TKO Group Holdings",
    parties: ["Susan Douglas", "Paul Romano", "UFC"],
  });
  assert.equal(q, "Douglas v. TKO Group Holdings");
});

test("source fallback builds q from selection and title", () => {
  const url = buildSourceSearchURL(
    {
      selection: "Susan Douglas and Paul Romano argued the event benefits UFC and TKO Group Holdings.",
      title: "Judge blocks UFC event lawsuit",
    },
    "r"
  );
  const p = paramsOf(url);
  assert.equal(p.get("type"), "r");
  assert.match(p.get("q"), /Susan Douglas/);
  assert.match(p.get("q"), /Paul Romano/);
  assert.match(p.get("q"), /UFC/);
  assert.match(p.get("q"), /Judge/);
});

test("appellate_freetext returns null when there is nothing to query", () => {
  assert.equal(buildCLSearchURL({}, "o", "appellate_freetext"), null);
});

test("appellate_freetext builds q from parties + hints and adds a date floor", () => {
  const url = buildCLSearchURL(
    { parties: ["United States", "State of Texas"], query_hints: ["SB4"], date_filed_year: 2024 },
    "o",
    "appellate_freetext"
  );
  const p = paramsOf(url);
  assert.match(p.get("q"), /United States/);
  assert.equal(p.get("filed_after"), "2023-01-01");
});

// ---- buildSearchPlan ----

test("a docket number forces RECAP-first ordering", () => {
  const plan = buildSearchPlan({ case_name: "X v. Y", docket_number: "1:24-cv-01" });
  assert.equal(plan[0].type, "r");
});

test("search plan includes a case-name free-text fallback", () => {
  const plan = buildSearchPlan({ case_name: "Douglas v. TKO Group Holdings", document_type: "docket" });
  assert.equal(plan.some((step) => step.strategy === "case_name_free"), true);
});

test("an opinion routes opinions-first", () => {
  const plan = buildSearchPlan({ case_name: "X v. Y", document_type: "opinion" });
  assert.equal(plan[0].type, "o");
});

test("appellate_freetext only appears for the opinions index", () => {
  const plan = buildSearchPlan({ case_name: "X v. Y", document_type: "opinion" });
  for (const step of plan) {
    if (step.strategy === "appellate_freetext") assert.equal(step.type, "o");
  }
});

test("identical URLs are de-duplicated (strict/loose collapse when court_id is null)", () => {
  const plan = buildSearchPlan({ case_name: "X v. Y", document_type: "opinion" });
  const urls = plan.map((s) => s.url);
  assert.equal(urls.length, new Set(urls).size);
});

// ---- rerankByDate ----

test("fewer than two results passes through untouched", () => {
  const one = [{ dateFiled: "2018-01-01" }];
  assert.deepEqual(rerankByDate(one, 2024), one);
});

test("a case at/after the hint year outranks an older one", () => {
  const ranked = rerankByDate(
    [{ dateFiled: "2018-01-01" }, { dateFiled: "2024-01-01" }],
    2024
  );
  assert.equal(ranked[0].dateFiled, "2024-01-01");
});

test("expanded case name leaves ordinary captions alone", () => {
  assert.equal(
    getExpandedCaseName({ case_name: "Loomer v. Maher", parties: ["Laura Loomer", "Bill Maher"] }),
    "Loomer v. Maher"
  );
});

test("rankSearchResults prefers the caption with the distinctive acronym expansion", () => {
  const ranked = rankSearchResults(
    [
      { caseName: "Taylor v. Trump", dateFiled: "2025-10-21", docketNumber: "1:25-cv-03742" },
      {
        caseName: "Trump v. British Broadcasting Corporation",
        dateFiled: "2025-12-15",
        docketNumber: "1:25-cv-25894",
      },
    ],
    {
      case_name: "Trump v. BBC",
      parties: ["Donald Trump", "British Broadcasting Corporation"],
      query_hints: ["defamation"],
      date_filed_year: 2025,
    },
    { title: "Trump sued BBC over edited clip" }
  );
  assert.equal(ranked[0].caseName, "Trump v. British Broadcasting Corporation");
});

test("rankSearchResults prefers the opinion whose caption matches the article framing", () => {
  const ranked = rankSearchResults(
    [
      { caseName: "In re Rudduck", dateFiled: "1987-03-10", docketNumber: "2-86-03308" },
      { caseName: "Disciplinary Counsel v. Rudduck", dateFiled: "2026-04-02", docketNumber: "2025-0203" },
    ],
    {
      case_name: "Rudduck",
      parties: ["Disciplinary Counsel", "John William Rudduck"],
      query_hints: ["Ohio Supreme Court endorsements"],
      date_filed_year: 2026,
    },
    { title: "Ohio Supreme Court disciplinary counsel endorsements Rudduck" }
  );
  assert.equal(ranked[0].caseName, "Disciplinary Counsel v. Rudduck");
});

test("scoreSourceOverlap notices when the result caption shares names with the selected text", () => {
  const overlap = scoreSourceOverlap(
    { caseName: "DOUGLAS v. NATIONAL PARK SERVICE" },
    {
      selection: "The two plaintiffs, Susan Douglas and Paul Romano, argued the events benefit UFC and TKO Group Holdings.",
      title: "Judge blocks UFC event lawsuit",
    }
  );
  assert.equal(overlap >= 1, true);
});

test("scorePhraseHits prefers exact party-name phrase matches from the selection", () => {
  const hits = scorePhraseHits(
    {
      caseName: "DOUGLAS v. NATIONAL PARK SERVICE",
      party: ["SUSAN DOUGLAS", "PAUL ROMANO", "NATIONAL PARK SERVICE"],
    },
    {
      selection: "The two plaintiffs, Susan Douglas and Paul Romano, argued the events benefit UFC and TKO Group Holdings.",
      title: "Judge blocks UFC event lawsuit",
    }
  );
  assert.equal(hits >= 2, true);
});

test("isPlausibleMatch rejects a zero-overlap result even when search returned something", () => {
  const plausible = isPlausibleMatch(
    { caseName: "The New York Times Company v. Microsoft Corporation", docketNumber: "1:23-cv-11195" },
    {
      case_name: "Susan Douglas v. UFC",
      parties: ["Susan Douglas", "Paul Romano", "UFC"],
      query_hints: ["TKO Group Holdings"],
      document_type: "docket",
    },
    {
      selection: "The two plaintiffs, Susan Douglas and Paul Romano, argued the events benefit UFC and TKO Group Holdings.",
      title: "Judge blocks UFC event lawsuit",
    }
  );
  assert.equal(plausible, false);
});
