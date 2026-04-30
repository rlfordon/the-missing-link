# Test Cases

Real-world articles for manually verifying the extension. Each entry captures what the article is, what failure mode it exercises, the expected CourtListener result, and the last observed behavior.

When you fix something or change the prompt, walk through this list and update the **Last observed** lines. When testers report a problem on a new article, add it here.

## How to test an entry

1. Reload the extension in `about:debugging` to pick up any recent code changes.
2. Open the article URL in Firefox.
3. If the entry says "Focus on …", select that passage in the page first.
4. Click the toolbar button.
5. Compare the popup result against **Expected**.
6. Update **Last observed** with what you saw and the date (`YYYY-MM-DD`).

---

## ACLU Texas — Fifth Circuit en banc on SB4

**URL:** https://www.aclutx.org/press-releases/fifth-circuit-rules-challenge-to-extreme-texas-immigration-law-must-be-dismissed-on-procedural-grounds/

**Mode:** Focus on `"NEW ORLEANS — The Fifth Circuit Court of Appeals today reversed a panel ruling that had affirmed a lower court's injunction against Texas Senate Bill 4 (88-4)..."`

**What it tests:** Consolidated-case naming on appeal. Article frames the case as *Las Americas Immigrant Advocacy Center v. Paxton* (ACLU's plaintiff line); the appellate caption is *United States v. State of Texas* (5th Cir. docket 24-50149).

**Expected:** https://www.courtlistener.com/opinion/10847941/united-states-v-state-of-texas/ (en banc opinion filed 2026-04-24).

**Last observed:**
- Before BACKLOG #1: returned the W.D. Tex. district court docket (`/docket/69197122/`) — wrong.
- After BACKLOG #1 (commit `749d704`), 2026-04-30, Haiku: returned the correct en banc opinion at `/opinion/10847941/united-states-v-state-of-texas/`. ✓

---

## Courthouse News — sanctions for AI-generated brief

**URL:** https://www.courthousenews.com/judge-rebukes-ex-doj-attorney-for-ai-generated-brief/

**Mode:** Whole page (or focus on the sanctions paragraph if the page covers multiple cases).

**What it tests:** District-court sanctions order on a recent filing — should route to RECAP, not the opinions index. Tests the `document_type` rule that pushes trial-court matters to RECAP. Previously returned a JSON error when using Haiku (now fixed by max_tokens bump in `be0c6f3`).

**Mode tested:** Focus on `"A federal magistrate judge officially reprimanded a former federal prosecutor Tuesday for an error-filled brief he admitted to using generative artificial intelligence on."`

**Expected:** TBD — the specific document is Tuesday's reprimand order. Find it on CourtListener (or confirm it isn't yet ingested) and record the URL.

**Last observed (2026-04-30, Haiku):** Right case, right docket, but the popup surfaced an older summary judgment order instead of Tuesday's reprimand. Likely Tuesday's document isn't yet on CourtListener (or `is_available: false`); the extension fell back to the next-most-recent available document. Also: the popup's "filed" date showed the case-filing date rather than the displayed document's date — confusing.

---

## Shore Daily News — Tangier Island federal lawsuit

**URL:** https://shoredailynews.com/headlines/tangier-island-officials-named-in-federal-lawsuit-filed-by-former-police-applicant/

**Mode:** Whole page.

**What it tests:** Recently filed district-court matter with **thin case-identifying info** in the article (no docket number, no formal caption — just "former police applicant sues officials"). Exposes how each model handles low-signal articles where extraction has to lean on inference.

**Expected:** https://www.courtlistener.com/docket/72126973/hayes-v-town-of-tangier-virginia/ (E.D. Va. docket; the article describes the complaint).

**Last observed (2026-04-30):**
- **Haiku:** WRONG — confidently surfaced *AAUP v. Rubio* (completely unrelated). https://www.courtlistener.com/docket/69784731/315/10/
- **Sonnet:** WRONG — confidently surfaced *Carroll v. Trump* (completely unrelated). https://www.courtlistener.com/docket/67373834/79/
- **Opus:** ✓ Correct docket (*Hayes v. Town of Tangier Virginia*). Did not surface the specific complaint within the docket.

**Failure pattern:** When the article is light on case identifiers, Haiku and Sonnet hallucinate case names confidently and the cascade finds *something* that matches the made-up name. Opus is significantly better at saying "I don't know exactly, but here's what the article describes" via better `query_hints` / `parties` extraction. This is a real model-capability gap on thin articles, not a prompt or cascade issue. Worse than "no match" because users see a confident wrong answer.

**Follow-up test (2026-04-30):** Re-ran on Haiku and Sonnet with explicit focus passage: `"Two Tangier Island officials and the town itself received notice late last week of a lawsuit filed against them in the U.S. District Court in Norfolk for deprivation of property. It is unclear what plaintiff Joseph Hayes, of New York, who was once considered for a job as the island's police officer, is attempting to accomplish with the filing"`. Even with the plaintiff name, the court, the location, and the role spelled out, **both Haiku and Sonnet still missed the case**. Suggests this isn't only "thin article" — there's something about how smaller models construct queries from this profile (very recent, low-prominence, common surname plaintiff) that the cascade can't recover from.

---

## Dean Blundell — Loomer v. Maher

**URL:** https://deanblundell.substack.com/p/breaking-laura-loomer-loses-bill

**Mode:** Whole page.

**What it tests:** The original case that motivated the extension. SDNY trial-court matter — should route to RECAP. Tests the most basic "find the obvious case" path. If this regresses, something fundamental broke.

**Expected:** TBD — find the SDNY docket and record the URL.

**Last observed (2026-04-30):** ✓ Still works on the current build (post-rename, post-cascade-refactor).

---

## Fivehouse v. U.S. Department of Defense

**Article URL:** TBD — capture next time you reproduce the original failure.

**What it tests:** Triggered the malformed-JSON bug — the model returned `"confidence":high` (no quotes) and cut off mid-field at `"docket_num`. Useful as a regression test for the tool-use refactor (BACKLOG #4). max_tokens bump in `be0c6f3` addresses truncation but not the unquoted-enum issue (which Haiku produces independently).

**Expected:** https://www.courtlistener.com/docket/71231282/129/fivehouse-v-us-department-of-defense/ (specific docket entry — confirmed available in RECAP, so once JSON parses cleanly the cascade should surface it). Court is E.D.N.C. (`nced`).

**Last observed:** When this article was tested with Haiku, the extraction call threw on malformed JSON and the cascade never ran, so the popup showed an error instead of a result. After BACKLOG #4 (tool-use refactor), this test case should resolve to the docket entry above.

---

## Categories worth filling in later

As the test set grows, you'll want representatives for each of these failure modes. Some of the above already cover several; others are open slots:

- **Clean SCOTUS opinion** — control case for opinions-index routing.
- **State supreme court ruling** — verifies the `document_type: "opinion"` rule extends beyond federal appellate.
- **Multiple cases on one page** — test that focus mode picks the right one.
- **Paywalled article that blocks selection** — confirm the extension fails gracefully (or that the cached-selection fallback in `content.js` catches it).
- **Non-case article** — verifies the "no case detected" empty state renders correctly.
- **Very old case** — tests when the article describes something that's deep in CourtListener's archives, not recent.
