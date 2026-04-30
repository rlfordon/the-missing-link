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

## Courthouse News — sanctions for AI-generated brief (Fivehouse v. DoD)

**URL:** https://www.courthousenews.com/judge-rebukes-ex-doj-attorney-for-ai-generated-brief/

**Case:** *Fivehouse v. U.S. Department of Defense*, E.D.N.C. (`court_id: "nced"`). The article describes the magistrate judge's reprimand order for the former federal prosecutor who used generative AI in his brief.

**Mode tested:** Focus on `"A federal magistrate judge officially reprimanded a former federal prosecutor Tuesday for an error-filled brief he admitted to using generative artificial intelligence on."`

**What it tests (multiple failure modes):**
1. District-court sanctions order — should route to RECAP, not opinions.
2. **Originally exposed the malformed-JSON / truncation bug.** Haiku returned `"confidence":high` (no quotes) and cut off mid-field at `"docket_num`. The truncation half is fixed by max_tokens bump (`be0c6f3`); the unquoted-enum half waits on BACKLOG #3 (tool-use refactor).
3. **Right docket, wrong document selection.** Even after the cascade lands the right docket, the popup picks the most-recent *available* document — which falls back to an older summary judgment when the recent reprimand isn't yet ingested or has `is_available: false`. Drives BACKLOG #4 (date-biased document selection + show document filing date).

**Expected:** https://www.courtlistener.com/docket/71231282/129/fivehouse-v-us-department-of-defense/ (Tuesday's reprimand order — confirmed available in RECAP).

**Last observed:**
- Original Haiku run (before max_tokens bump): JSON parse error, popup showed "Something went wrong."
- After `be0c6f3` (max_tokens 1500), 2026-04-30, Haiku: returns the right docket but surfaces an older summary judgment order instead of Tuesday's reprimand. Popup meta shows the case-filing date rather than the displayed document's date — confusing.
- After BACKLOG #3 (tool-use refactor): the unquoted-enum failure mode should disappear. Verify by re-running.
- After BACKLOG #4 (document-selection improvements): the right-docket-wrong-document failure should resolve.

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

## Guardian — Voting Rights Act (Louisiana v. Callais)

**URL:** https://www.theguardian.com/commentisfree/2026/apr/30/supreme-court-voting-rights-act-ruling

**Mode:** Whole page.

**What it tests:** Clean SCOTUS opinion — control case for opinions-index routing. Article is an op-ed about the ruling but mentions the case directly enough for the model to identify it.

**Expected:** https://www.courtlistener.com/opinion/10850261/louisiana-v-callais/

**Last observed (2026-04-30, Haiku):** ✓ Returned the correct SCOTUS opinion.

---

## PBS NewsHour — Voting Rights Act decision

**URL:** https://www.pbs.org/newshour/show/how-the-supreme-courts-decision-weakens-the-voting-rights-act-nationwide

**Mode:** Whole page.

**What it tests:** Content extraction on a video-first transcript page. Different failure class than the others — fails *before* the model is called.

**Last observed (2026-04-30):** Popup shows "Page is empty — No readable text was found on this page." The `content.js` pickRoot/extractText path returned <40 chars. Likely cause: PBS NewsHour articles are video-led, with transcript text either in iframes (TreeWalker can't cross frame boundaries from a top-frame content script), in shadow DOM (TreeWalker can't cross shadow roots either), or rendered after `document_idle` by JS.

**Possible fixes (worth a BACKLOG entry):**
- Walk all same-origin iframes' documents in addition to the top frame.
- Add a fallback that retries extraction after a short delay if the first pass gets <40 chars.
- Add `document.querySelector(".transcript")` and similar common patterns to `pickRoot`'s candidate list.

---

## Categories worth filling in later

As the test set grows, you'll want representatives for each of these failure modes. Some of the above already cover several; others are open slots:

- **Clean SCOTUS opinion** — control case for opinions-index routing.
- **State supreme court ruling** — verifies the `document_type: "opinion"` rule extends beyond federal appellate.
- **Multiple cases on one page** — test that focus mode picks the right one.
- **Paywalled article that blocks selection** — confirm the extension fails gracefully (or that the cached-selection fallback in `content.js` catches it).
- **Non-case article** — verifies the "no case detected" empty state renders correctly.
- **Very old case** — tests when the article describes something that's deep in CourtListener's archives, not recent.
