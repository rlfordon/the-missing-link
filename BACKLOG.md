# Backlog

Forward-looking improvements, ordered roughly by ROI. Not a roadmap — pick from this list when you have time.

## 1. Prompt: handle consolidated-case naming explicitly

**Problem:** The model can't predict that an article framing a case one way might be captioned differently on appeal. It outputs the case name the article uses, which sometimes doesn't match the appellate index.

**Fix:** Add a rule to `EXTRACT_SYSTEM` in `background.js`: when the page describes an appellate ruling, the appellate caption may differ from the named plaintiff (consolidations, US-vs-state actions, multi-plaintiff litigation). Encourage the model to output multiple `query_hints` covering plausible appellate captions (e.g., `["Las Americas Paxton", "United States v. Texas", "Texas SB4"]`).

**Scope:** Prompt edit, ~10 lines. Pairs naturally with the appellate-freetext cascade pass already shipped — broader `query_hints` makes that pass more likely to hit.

**Limit:** Won't always work — sometimes the appellate name is genuinely unknowable from the article. Raises the floor, doesn't eliminate misses.

## 2. UI: court-aware "you might also want" alternates

**Problem:** When the cascade returns a RECAP docket but the article actually describes an appellate ruling, the user has no obvious way to discover that the appellate opinion exists.

**Fix:** When the popup renders a RECAP result *and* the article mentioned an appellate court (5th Cir., 9th Cir., SCOTUS, state supreme court), surface a secondary link: "Recent opinions from [court]" pointing to a CourtListener opinions search filtered by that court + recent date range. Lets the user click through and find the appellate opinion the cascade missed.

**Scope:** UI work in `popup.js`'s `renderResult`. Needs a new field or two from the extraction (we'd want the explicit court name from the article). Maybe ~30-50 lines.

## 3. Tool-use refactor: eliminate malformed-JSON errors

**Problem:** Models occasionally produce malformed JSON: unquoted enum values (`"confidence":high` instead of `"confidence":"high"`), truncated output, stray code fences. The current parser fails noisily on any of these. **Originally suspected to be Haiku-only, but confirmed to also occur on Opus** — this is not "switch to a smarter model and forget it"; it's a fundamental reliability issue with prompt-engineered JSON that affects every model tier.

**Fix:** Switch from "ask for JSON in the system prompt" to Anthropic tool use. Define a tool `record_case_extraction` whose `input_schema` matches the current extraction shape. Call the API with `tools: [tool]` and `tool_choice: { type: "tool", name: "record_case_extraction" }`. Parse the `tool_use` block instead of `text` content. The API validates against the schema before returning, so:

- Unquoted strings → impossible
- Missing required fields → impossible
- Extra fields → impossible
- Code fences → impossible (tool calls are structured)
- Truncation mid-string → still possible but the error is structured, not a parser explosion

The system prompt shrinks because field descriptions migrate into the tool's schema.

**Scope:** ~30-50 lines in `background.js`. No popup or content-script changes.

**Why higher priority now:** Confirmed across all model tiers, not just Haiku. Test case: `Fivehouse v. U.S. Department of Defense`. The target docket entry exists and is available in RECAP (`/docket/71231282/129/`); we just can't get there because the extraction call fails.

## 4. Better RECAP document selection within a docket

**Problem:** When the cascade lands on the right docket but there are multiple documents in it, the popup picks the most-recent *available* document. Two issues observed in the Courthouse News (AI-generated brief) test:

1. The "filed" date shown in the popup meta is the *case-filing* date, not the *displayed document's* date — confusing when the surfaced doc is from years ago.
2. If the article describes a recent order that isn't yet on CourtListener (or has `is_available: false`), the cascade falls back to the most recent available doc, which may be unrelated to what the user wanted.

**Fix:**

- **Show the selected document's `entry_date_filed` in the popup meta**, distinguished from the case-filing date. ~5 lines in `popup.js`.
- **Bias document selection toward the article's `date_decided` hint** when present: prefer the available doc with `entry_date_filed` closest to that date, rather than just the most recent. ~10 lines in `popup.js`.
- **Surface a "most recent activity is $date" hint** when the article's `date_decided` is much later than the most-recent available doc, so the user knows the doc they're after probably isn't on CL yet.

**Scope:** ~15-20 lines, all in `popup.js`. No prompt or cascade changes.

## 5. Confidence calibration / result validation for thin articles

**Problem:** When the article gives thin case-identifying info (no docket number, no formal caption, just narrative description), Haiku and Sonnet hallucinate case names *with high confidence* and the cascade finds whatever case matches the hallucinated name. The user sees a confident wrong answer — a worse failure than "no match" because there's no signal that the result is unreliable. Opus is markedly better at this; the gap is real model-capability difference.

**Test case (Shore Daily News / Tangier Island):**

- Haiku: returned *AAUP v. Rubio* (unrelated)
- Sonnet: returned *Carroll v. Trump* (unrelated)
- Opus: returned the correct *Hayes v. Town of Tangier Virginia*

**Possible fixes (not exclusive):**

- **Post-cascade validation.** After the cascade returns a candidate case, verify its parties / case name appear in the original article text. If not, downgrade the confidence chip to "low" and flag in the popup that the match wasn't textually validated.
- **Stronger prompt for thin articles.** Add a rule to `EXTRACT_SYSTEM`: "If you cannot identify a specific case from the article with at least one concrete signal (party name, docket number, court, citation), set `is_case: false` rather than guessing. A `null` is better than a hallucinated case name."
- **Default-to-Opus for low-signal articles.** Riskier — would require detecting "low signal" before the model sees the article.

**Scope:** Validation is the most targeted fix — ~20 lines, splits between `background.js` (matching parties against article text) and `popup.js` (rendering the warning). Prompt edit is a few lines but harder to reason about.

## 6. "Open in tab" affordance for the popup

**Problem:** Browser popups auto-close on focus loss — a hard convention we can't override. The copy-link button (already shipped) handles "I want the URL"; this would handle "I want to keep the result visible while I work."

**Fix:** Add a small "open in tab" link in the popup footer. Clicking opens the same result content in a regular tab via a small `popup-as-tab.html` page that takes the data via URL hash or `browser.storage.local`. Tab-rendered version uses the same CSS so it visually matches.

**Scope:** ~30 lines: a new HTML file, a small JS bootstrap, a link in the popup footer. No data-flow changes.

**Why deferred:** Most users will get value from the copy-link button + the result links opening in new tabs. This is a power-user affordance.
