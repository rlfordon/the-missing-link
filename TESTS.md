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
- After BACKLOG #1 (commit `749d704`): TBD — re-test.

---

## Courthouse News — sanctions for AI-generated brief

**URL:** https://www.courthousenews.com/judge-rebukes-ex-doj-attorney-for-ai-generated-brief/

**Mode:** Whole page (or focus on the sanctions paragraph if the page covers multiple cases).

**What it tests:** District-court sanctions order on a recent filing — should route to RECAP, not the opinions index. Tests the `document_type` rule that pushes trial-court matters to RECAP.

**Expected:** TBD — verify by reading the article and searching CourtListener for the sanctioned case.

**Last observed:** Not yet recorded.

---

## Shore Daily News — Tangier Island federal lawsuit

**URL:** https://shoredailynews.com/headlines/tangier-island-officials-named-in-federal-lawsuit-filed-by-former-police-applicant/

**Mode:** Whole page.

**What it tests:** Recently filed district-court matter (E.D. Va. likely). Tests RECAP routing for fresh dockets that don't yet have published opinions. Also tests handling when the article doesn't give a docket number.

**Expected:** TBD — find the docket on CourtListener and record the URL.

**Last observed:** Not yet recorded.

---

## Dean Blundell — Loomer v. Maher

**URL:** https://deanblundell.substack.com/p/breaking-laura-loomer-loses-bill

**Mode:** Whole page.

**What it tests:** The original case that motivated the extension. SDNY trial-court matter — should route to RECAP. Tests the most basic "find the obvious case" path. If this regresses, something fundamental broke.

**Expected:** TBD — find the SDNY docket and record the URL.

**Last observed:** Worked correctly in early dev (before rename / icon / cascade refactors). Re-verify against current build.

---

## Fivehouse v. U.S. Department of Defense (no URL yet)

**What it tests:** Triggered the malformed-JSON / truncation bug — the model returned `"confidence":high` (no quotes) and cut off mid-field at `"docket_num`. Useful as a regression test for the tool-use refactor (BACKLOG #4).

**Expected:** Capture the URL and add it here next time you reproduce the issue. The article is presumably about an E.D.N.C. case captioned `Fivehouse v. U.S. Department of Defense` (court_id `nced`).

---

## Categories worth filling in later

As the test set grows, you'll want representatives for each of these failure modes. Some of the above already cover several; others are open slots:

- **Clean SCOTUS opinion** — control case for opinions-index routing.
- **State supreme court ruling** — verifies the `document_type: "opinion"` rule extends beyond federal appellate.
- **Multiple cases on one page** — test that focus mode picks the right one.
- **Paywalled article that blocks selection** — confirm the extension fails gracefully (or that the cached-selection fallback in `content.js` catches it).
- **Non-case article** — verifies the "no case detected" empty state renders correctly.
- **Very old case** — tests when the article describes something that's deep in CourtListener's archives, not recent.
