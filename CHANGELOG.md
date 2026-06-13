# Changelog

## 0.6.0

- **Published to the Chrome Web Store.** Public listing: https://chromewebstore.google.com/detail/the-missing-link/keabioafoggdllieldimckfijklbdoii
- **Chrome support via MV3.** The extension now runs in Chrome/Chromium with an MV3 manifest, `action`, host permissions, a service-worker loader, and the vendored `webextension-polyfill`.
- **Safer and smarter CourtListener matching.** Search now handles acronym-heavy captions better (for example `BBC`/`British Broadcasting Corporation`), simplifies certain government-plaintiff RECAP captions, runs compact fallback queries from the selected text/title, and rejects obviously implausible matches instead of confidently surfacing unrelated cases.
- **Much better behavior on several real-world misses.** Reuters `Trump v. BBC`, EEOC/JAG, Tangier, and the Politico UFC follow-up all improved materially during manual testing; some still remain imperfect on exact document selection or thin/paywalled coverage.
- **Chrome popup recovery.** If Chrome opens the popup on a page where the content script is missing, the popup now injects the content script on demand and retries instead of failing immediately with "Receiving end does not exist."
- **Popup metadata polish.** When a RECAP document is the primary result, the popup now prefers that document's filing date/snippet rather than always showing the docket's filing date.

## 0.5.0

- **First submission to addons.mozilla.org** (Firefox desktop). Adds a privacy policy and reviewer notes.
- **More reliable case extraction.** Claude now returns the case identifiers via the Anthropic tool-use API instead of free-form JSON, which eliminates a class of failures where a malformed or truncated JSON response produced a "Something went wrong" error (notably on Haiku).
- **Better re-ranking of district-court results.** When several dockets share a similar caption, results are re-ranked toward the year the article is about, so a freshly-filed case isn't buried under an older one with more activity.
- **Sharper captions when a government sues a government** (e.g. United States v. a state) — uses the entity name rather than a named official.
- Internal: the CourtListener query logic was split into its own module with an automated test suite; no user-facing change.

## 0.4.0

- **Model picker** in settings — choose between Haiku 4.5 (fast/cheap), Sonnet 4.6 (balanced, default), and Opus 4.7 (best quality).
- **Copy-link button** in the popup — grab the result URL without right-clicking, since right-click closes the popup.
- **Better case identification on consolidated and appellate cases.** When an article frames a case under one party's name but the appellate court captioned it differently (e.g., article says "Las Americas v. Paxton" but the 5th Cir. opinion is "United States v. State of Texas"), the search cascade now runs a free-text pass against the opinions index using parties + court + date and catches the right opinion.
- **Fewer extraction failures** — bumped Claude's response token budget so the JSON output doesn't truncate mid-field on case-heavy articles.
- 128 px icon shipped alongside 48/96 for AMO listing.
- README split: user-facing in `README.md`, developer/architecture notes in `DEVELOPMENT.md`.

## 0.3.0

- Renamed from CourtListener Finder to The Missing Link.
- New icon: bracketed-ellipsis `[…]` mark, matching the legal-citation aesthetic of the popup.
- Manifest cleanup for AMO submission: stable gecko id, `homepage_url`, `author`, sharper description.

## 0.2.0

- Added focus mode: select a passage on the page before clicking, and Claude resolves *that* case specifically while still using the rest of the page for context.
- Cached selection survives the popup-open focus shuffle on sites that clear selection on blur.
- Popup shows a small "focused on your selection" tag when a selection drove the result.

## 0.1.1

- Sharper extraction prompt: better rules for `document_type` so trial-court matters route to RECAP and appellate opinions route to Opinions.
- Search cascade instead of a single attempt — tries `strict → loose → free` query variants across both CL indexes before giving up.
- Better fallback links when no match is found: surfaces both RECAP and opinions search, with the more-likely one primary.
- Diagnostics: popup footer reports number of search attempts.

## 0.1.0

- Initial release.
- Extracts visible page text, sends to Claude for structured case identification, queries CourtListener REST search for the match.
