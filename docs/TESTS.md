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
- 2026-06-05 — tool-use refactor landed (BACKLOG #3): `extractCaseInfo` now uses Anthropic forced tool use and reads the parsed `tool_use.input`, so the unquoted-enum / malformed-JSON / code-fence parse-failure class is structurally eliminated (no model-text JSON.parse remains).
- 2026-06-05, Sonnet 4.6 (verified): ✓ the parse-failure class is gone — no "Something went wrong." Correctly returned the *Fivehouse v. DoD* docket (https://www.courtlistener.com/docket/71231282/fivehouse-v-us-department-of-defense/). Still surfaced the docket root rather than the specific reprimand order (`/129`) — the right-docket-wrong-document gap (BACKLOG #4) is unchanged, as expected.
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

**Last observed (2026-06-05, Sonnet 4.6):** WRONG — surfaced *AAUP v. Rubio* (https://www.courtlistener.com/docket/69784731/american-association-of-university-professors-v-rubio/), completely unrelated. Consistent with the 2026-04-30 thin-info failure pattern below (Sonnet's wrong answer shifted from *Carroll v. Trump* to *AAUP v. Rubio*, but it's still confidently wrong). Not a regression from the tool-use refactor — a standing model-capability gap on low-signal articles.

**Follow-up test (2026-04-30):** Re-ran on Haiku and Sonnet with explicit focus passage: `"Two Tangier Island officials and the town itself received notice late last week of a lawsuit filed against them in the U.S. District Court in Norfolk for deprivation of property. It is unclear what plaintiff Joseph Hayes, of New York, who was once considered for a job as the island's police officer, is attempting to accomplish with the filing"`. Even with the plaintiff name, the court, the location, and the role spelled out, **both Haiku and Sonnet still missed the case**. Suggests this isn't only "thin article" — there's something about how smaller models construct queries from this profile (very recent, low-prominence, common surname plaintiff) that the cascade can't recover from.

---

## Dean Blundell — Loomer v. Maher

**URL:** https://deanblundell.substack.com/p/breaking-laura-loomer-loses-bill

**Mode:** Whole page.

**What it tests:** The original case that motivated the extension. SDNY trial-court matter — should route to RECAP. Tests the most basic "find the obvious case" path. If this regresses, something fundamental broke.

**Expected:** https://www.courtlistener.com/docket/69387382/loomer-v-maher/ (SDNY docket).

**Last observed (2026-04-30):** ✓ Still works on the current build (post-rename, post-cascade-refactor).
**Last observed (2026-06-05, Sonnet 4.6):** ✓ Correct — returned the SDNY *Loomer v. Maher* docket (https://www.courtlistener.com/docket/69387382/195/loomer-v-maher/). RECAP routing canary intact after the search.js extraction + tool-use refactor.

---

## Washington Post — non-case article (Surgeon General nominee)

**URL:** https://www.washingtonpost.com/health/2026/04/30/surgeon-general-nominee-means-saphier/

**Mode:** Whole page.

**What it tests:** Non-case article. Verifies the "no case detected" empty state — the extension shouldn't try to invent a case when the page isn't about litigation.

**Expected:** Empty state ("No case detected").

**Last observed (2026-04-30):** ✓ Correctly returned "no case detected."
**Last observed (2026-06-05, Sonnet 4.6):** ✓ Correctly returned "no case detected" (empty state).

---

## 1027 Superhits — multi-case article, focus on Casey

**URL:** https://1027superhits.com/2025/12/06/us-supreme-court-may-be-poised-to-ditch-more-of-its-precedents/

**Mode:** Focus on `"In a 1992 abortion rights case called Casey v. Planned Parenthood, the Supreme Court listed five factors to be considered when deciding whether to overrule a prior decision, such as whether the precedent is easy to apply and whether people have structured their lives based on it."`

**What it tests:** Focus mode on a long article that discusses multiple SCOTUS cases. The selected passage names the case (*Casey v. Planned Parenthood*) but with the parties reversed from the official caption (*Planned Parenthood v. Casey*). Tests both focus-mode handling and resilience to reversed-party-order framing.

**Expected:** https://www.courtlistener.com/opinion/117828/planned-parenthood-of-southeastern-pennsylvania-v-casey-no-a-655/

**Last observed (2026-04-30, Haiku):** ✓ Correctly returned the Casey opinion despite reversed party order in the focus text.
**Last observed (2026-06-05, Sonnet 4.6):** ✓ Correct — returned *Planned Parenthood v. Casey* (https://www.courtlistener.com/opinion/112786/planned-parenthood-of-southeastern-pa-v-casey/) despite the reversed party order in the focus passage.

---

## Constitution Center blog — Ten Commandments / 5th Circuit

**URL:** https://constitutioncenter.org/blog/supreme-court-showdown-over-ten-commandments-likely-after-federal-court-decision

**Mode:** Whole page.

**What it tests:** Article discusses several cases in passing but is mainly about a recent 5th Circuit decision on Ten Commandments displays. Tests handling of an article that mentions multiple cases without focus mode.

**Expected:** TBD — verify the case caption. The article is about a 5th Circuit decision on Ten Commandments, likely *Roake v. Brumley* or similar Louisiana case. The result *Nathan v. Alamo Heights ISD* surfaced by Haiku looks plausibly related but the name doesn't obviously match the article topic — worth confirming.

**Last observed (2026-04-30, Haiku):** Returned https://www.courtlistener.com/opinion/10846394/nathan-v-alamo-heights-isd/. User flagged this as "probably the right call" but with some uncertainty. Good candidate for the post-cascade validation in BACKLOG #5: if "Nathan" and "Alamo Heights" don't appear in the article, the confidence chip should reflect that.
**Last observed (2026-06-05, Sonnet 4.6):** Returned the same *Nathan v. Alamo Heights ISD* (https://www.courtlistener.com/opinion/10846394/nathan-v-alamo-heights-isd/) — does not obviously match the article's Ten Commandments / 5th Cir. topic. Pre-existing multi-case-without-focus accuracy gap (not a regression); reinforces the need for the BACKLOG #5 confidence/validation pass.

---

## The Conversation — focus on un-named older case (Shelby County v. Holder)

**URL:** https://theconversation.com/supreme-court-ruling-the-latest-in-history-of-diminishing-minority-voting-rights-281815

**Mode:** Focus on `"Back in 2013, the Supreme Court tossed out a key provision of the Voting Rights Act regarding federal oversight of elections."`

**What it tests:** Focus mode where the focus passage *describes* a case without *naming* it. The article's main subject is the recent *Louisiana v. Callais* ruling; the focus passage is about *Shelby County v. Holder* (570 U.S. 529, 2013) — the SCOTUS case that gutted VRA Section 5. Tests whether the model uses world knowledge to identify a case from descriptive context (year + court + subject) when the passage gives no caption.

**Expected:** *Shelby County v. Holder* (the un-named 2013 case): https://www.courtlistener.com/opinion/931614/shelby-county-v-holder/

**Last observed (2026-04-30, Haiku):** ✗ Returned *Louisiana v. Callais* (the page's main subject), ignoring the focus passage entirely. The model defaulted to the dominant page case rather than inferring Shelby County from "2013 + SCOTUS + VRA + federal oversight."
**Last observed (2026-06-05, Sonnet 4.6):** ✓ Correct — inferred *Shelby County v. Holder* (https://www.courtlistener.com/opinion/931614/shelby-county-v-holder/) from the descriptive focus passage with no caption present. Note this is a stronger model than the 2026-04-30 Haiku baseline, so it's a model-capability difference, not proof the prompt fix below was applied — the focus-override-on-described-not-named case still warrants the EXTRACT_SYSTEM hardening noted in the failure pattern, since Haiku is a user-selectable model.

**Failure pattern:** Different from the Tangier failure. Tangier was *hallucination* — the model confidently invented a wrong case name. This is *focus override* — the model received an explicit focus instruction but reverted to the page's main subject when the focus passage didn't contain a literal case name to extract. Suggests the prompt's "focus overrides the page's main case" rule isn't strong enough for cases-described-not-named. Possible fix: add to `EXTRACT_SYSTEM` an instruction like "If the focus passage describes a case but doesn't name it, use your training-data knowledge to identify the case from context (year + court + subject matter); do not fall back to the page's main case."

---

## Columbus Dispatch — Ohio Supreme Court (Disciplinary Counsel v. Rudduck)

**URL:** https://www.dispatch.com/story/news/politics/2026/04/14/ohio-supreme-court-says-rule-blocking-endorsements-is-unconstitutional/89603915007/

**Mode:** Whole page.

**What it tests:** State supreme court ruling — verifies the `document_type: "opinion"` rule extends beyond federal appellate courts. Also tests resilience to **paywalled content**: most of the article was behind a paywall, but the visible portion gave Claude enough to identify the case.

**Expected:** https://www.courtlistener.com/opinion/10831814/disciplinary-counsel-v-rudduck/

**Last observed (2026-04-30, Haiku):** ✓ Returned the correct Ohio Supreme Court opinion despite limited visible text.
**Last observed (2026-06-05, Sonnet 4.6):** ⚠️ Near-miss — returned *In re Rudduck* (https://www.courtlistener.com/opinion/8518051/in-re-rudduck/), an older Rudduck disciplinary matter, rather than the 2026 *Disciplinary Counsel v. Rudduck* ruling the article is about. Right attorney, wrong (older) case. NOT a regression from the tool-use refactor — the 2026-04-30 ✓ was Haiku; this is per-model accuracy variance on a paywalled, thin-visible-text article. `rerankByDate` does not apply here (opinions index, not RECAP), so date-proximity re-ranking can't help; candidate for the BACKLOG #5 post-cascade validation.

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

## Reuters — Trump v. BBC ($10B defamation, missed-deadline order)

**URL:** https://www.reuters.com/legal/government/us-judge-orders-trump-lawyers-explain-missed-deadline-10-billion-bbc-defamation-2026-06-08/

**Mode:** Whole page.

**What it tests:** Article about a procedural order (judge orders Trump's lawyers to explain a missed deadline) in the $10 billion BBC defamation suit. Tests case identification when the article's party is an extremely high-frequency name ("Trump") that appears across hundreds of CourtListener dockets. The article identifies the matter clearly — BBC, $10 billion, defamation — yet the cascade landed on a completely unrelated docket where Trump is merely a party.

**Expected:** https://www.courtlistener.com/docket/72040010/trump-v-british-broadcasting-corporation/ (the district-court defamation docket the article is about).

**Last observed (2026-06-08, Opus):** ✗ WRONG — returned *Taylor v. Trump* (https://www.courtlistener.com/docket/71717101/1/taylor-v-trump/), an unrelated matter that merely shares "Trump" as a party (and with the role reversed — Trump is the defendant there, the plaintiff in the BBC suit). RECAP routing was correct (both are dockets); the failure is case-name *matching*, not index routing.

**Failure pattern:** Distinct from the Tangier hallucination and the Shelby County focus-override cases. Here the article is *not* thin — it names BBC, the $10B figure, and the defamation posture — and the failure persists on Opus, the strongest model. That points away from extraction quality and toward the search/cascade: a high-frequency party name ("Trump") lets the `loose`/`free` strategies surface a prominent but wrong Trump docket. Worth confirming whether extraction produced the right `case_name`/`parties` (e.g. "Trump v. British Broadcasting Corporation") and the CourtListener query still returned the wrong docket, vs. extraction itself fixating on "Trump." If extraction is correct, candidates to investigate: requiring the distinctive party ("British Broadcasting Corporation" / "BBC") in the case-name match before falling back to free-text, and the BACKLOG #5 post-cascade validation (distinctive tokens from the article should appear in the chosen docket's caption).

---

## EEOC — JAG Physical Therapy pregnancy discrimination suit

**URL:** https://www.eeoc.gov/newsroom/jag-physical-therapy-pay-125000-eeoc-pregnancy-discrimination-lawsuit

**Mode:** Focus on `"The EEOC filed suit in U.S. District Court for the Eastern District of New York (EEOC v. PT Administrative Services LLC d/b/a JAG Physical Therapy, Case No. 1:25-cv-03615) after first attempting to reach a pre-litigation settlement through its conciliation process."`

**What it tests:** A high-signal focus-selection case where the selected sentence contains the plaintiff, defendant, exact court, and exact docket number. This should be one of the easiest possible RECAP lookups. Instead, the extension returned a completely different `Administrative Services LLC` case in a different district. Tests whether extraction/search drops the distinctive tokens (`EEOC`, `PT`, `JAG Physical Therapy`, `E.D.N.Y.`, `1:25-cv-03615`) and overweights the generic corporate suffix.

**Expected:** https://www.courtlistener.com/docket/70671708/us-equal-employment-opportunity-commission-v-pt-administrative-services/ (*U.S. Equal Employment Opportunity Commission v. PT Administrative Services LLC*, E.D.N.Y., 1:25-cv-03615).

**Last observed (2026-06-12, focused selection):** ✗ WRONG — returned *Orechovesky v. BNY Administrative Services LLC* (S.D.N.Y., 1:25-cv-08517), a different `Administrative Services LLC` case with the wrong plaintiff, wrong defendant, wrong district, and wrong docket.
**Last observed (2026-06-12, after RECAP caption simplification fix):** ✓ Correct — returned *U.S. Equal Employment Opportunity Commission v. PT Administrative Services LLC* (https://www.courtlistener.com/docket/70671708/us-equal-employment-opportunity-commission-v-pt-administrative-services/). The search-side fix that simplifies certain government-plaintiff RECAP captions to the defendant-side legal name appears to recover this case cleanly.

**Failure pattern:** Distinct from the Reuters Trump/BBC failure. This is not a thin article and not a broad-name collision on a common party alone — the selected sentence contains the exact docket number and court. The likely weak point is either extraction normalizing away too much of the caption, or the search cascade/query construction not preserving enough distinctive tokens once it sees the generic `Administrative Services LLC` suffix. As noted in manual triage, CourtListener captions the plaintiff as the full `U.S. Equal Employment Opportunity Commission`, not `EEOC`, so acronym expansion may also matter here.

---

## Recent Retest Notes (2026-06-12)

- **Tangier Island:** Improved again â€” now matched the correct case from the whole page.
- **Washington Post surgeon-general article:** Still correctly returned **No case detected**.
- **Reuters Trump/BBC:** Now correctly returned *Trump v. British Broadcasting Corporation* after the acronym-expansion + richer free-text fallback search changes.
- **Columbus Dispatch / Rudduck:** Improved but not fully fixed â€” with a narrow selection from the article, *Disciplinary Counsel v. Rudduck* surfaced in the result list, but not as the top hit.
- **Politico June 12 follow-up on UFC White House lawsuit:** Improved substantially. A slight regression remains in the top match on at least one path, but the correct litigation now surfaced in the result list even without a selection, and with a focused selection it returned the right case family (if not always the exact best document).
- **Politico June 7 UFC White House story:** Correctly returned *Douglas v. National Park Service*.
- **TribLive Primanti Bros. mural lawsuit:** Returned **No match on CourtListener**. Manual CourtListener searches for combinations of `Kanfoush`, `Primanti`, `mural`, `copyright`, `Visual Artists Rights Act`, and `Pittsburgh` did not surface an obvious corresponding docket, so this currently looks more like "not yet on CourtListener / not yet indexed" than an extension-specific failure.
- **New manual checks outside the original matrix:** No other regressions were found across the prior test set. Additional misses on very recent Trump-related and Supreme Court-related items may reflect a mix of extraction difficulty and recency/ingestion lag rather than obvious regressions in the extension itself.

## Still-open categories worth filling in

These are gaps the existing 11 test cases don't cover:

- **Site that hard-blocks text selection.** Tests whether `content.js`'s cached-selection fallback recovers when `window.getSelection()` returns nothing because the page actively suppresses selection (CSS `user-select: none` or JS handlers). None of the current tests specifically stress this — the paywalled Dispatch article passed without testing focus mode there.
- **Truly old / archival case.** *Casey* (1992) is the oldest in the corpus. A pre-1990 case (e.g., *Roe* or *Brown v. Board*) would test whether the cascade behaves correctly when the article describes something deep in CourtListener's archives.
- **Article describing a case that genuinely isn't on CourtListener** (e.g., a state trial-court matter not in RECAP). Tests the "no match" fallback flow with the manual-search links.
- **SCOTUS oral argument coverage** rather than a decided opinion. Tests whether the cascade routes correctly when the article is about an *argued-but-undecided* case.
