# Backlog

Forward-looking improvements, ordered roughly by ROI. Not a roadmap — pick from this list when you have time.

## 1. Search cascade: free-text pass against opinions index with stronger signals

**Problem:** When the model identifies a case correctly but the case name on appeal differs from the trial-court name (consolidated actions, US-vs-state matters, multi-plaintiff litigation), the strict/loose case-name searches miss the appellate opinion entirely. Real example: ACLU press release frames the SB4 ruling as *Las Americas v. Paxton*; the 5th Circuit en banc opinion is captioned *United States v. State of Texas* — the cascade falls through to RECAP and finds the district court docket instead of the en banc opinion.

**Fix:** Add a "free-text against opinions index" pass to the cascade in `background.js` (`searchCourtListener`) using stronger signals than just `query_hints[0]`. Build the query from `parties` (joined) + `court_id` + `date_filed_year` filter — e.g., `q="Texas Senate Bill 4" court=ca5 filed_after=2026-04-01`. Try this *before* falling through to RECAP, when `document_type` is "opinion" but the case-name search returned nothing.

**Scope:** ~20 lines in `background.js`. No prompt changes. No UI changes.

**Why first:** Highest ROI. Catches an entire class of "consolidated case rename on appeal" failures with minimal code.

## 2. Prompt: handle consolidated-case naming explicitly

**Problem:** The model can't predict that an article framing a case one way might be captioned differently on appeal. It outputs the case name the article uses, which sometimes doesn't match the appellate index.

**Fix:** Add a rule to `EXTRACT_SYSTEM` in `background.js`: when the page describes an appellate ruling, the appellate caption may differ from the named plaintiff (consolidations, US-vs-state actions, multi-plaintiff litigation). Encourage the model to output multiple `query_hints` covering plausible appellate captions (e.g., `["Las Americas Paxton", "United States v. Texas", "Texas SB4"]`).

**Scope:** Prompt edit, ~10 lines. Pairs naturally with #1 — broader `query_hints` makes the free-text pass more likely to hit.

**Limit:** Won't always work — sometimes the appellate name is genuinely unknowable from the article. Raises the floor, doesn't eliminate misses.

## 3. UI: court-aware "you might also want" alternates

**Problem:** When the cascade returns a RECAP docket but the article actually describes an appellate ruling, the user has no obvious way to discover the appellate opinion exists.

**Fix:** When the popup renders a RECAP result *and* the article mentioned an appellate court (5th Cir., 9th Cir., SCOTUS, state supreme court), surface a secondary link: "Recent opinions from [court]" pointing to a CourtListener opinions search filtered by that court + recent date range. Lets the user click through and find the appellate opinion the cascade missed.

**Scope:** UI work in `popup.js`'s `renderResult`. Needs a new field or two from the extraction (we'd want the explicit court name from the article). Maybe ~30-50 lines.

## 4. Tool-use refactor: eliminate JSON parsing errors

**Problem:** Smaller models (Haiku) occasionally produce malformed JSON: unquoted enum values (`"confidence":high` instead of `"confidence":"high"`), truncated output, stray code fences. The current parser fails noisily on any of these.

**Fix:** Switch from "ask for JSON in the system prompt" to Anthropic tool use. Define a tool `record_case_extraction` whose `input_schema` matches the current extraction shape. Call the API with `tools: [tool]` and `tool_choice: { type: "tool", name: "record_case_extraction" }`. Parse the `tool_use` block instead of `text` content. The API validates against the schema before returning, so:

- Unquoted strings → impossible
- Missing required fields → impossible
- Extra fields → impossible
- Code fences → impossible (tool calls are structured)
- Truncation mid-string → still possible but the error is structured, not a parser explosion

The system prompt shrinks because field descriptions migrate into the tool's schema.

**Scope:** ~30-50 lines in `background.js`. No popup or content-script changes.

**Why not first:** The current Haiku-bumps-to-1500-tokens fix handles the most common symptom (truncation). Tool use is the durable fix but a bigger change.
