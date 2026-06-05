const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildCLSearchURL, buildSearchPlan, rerankByDate, CL_BASE } = require("../search.js");

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
