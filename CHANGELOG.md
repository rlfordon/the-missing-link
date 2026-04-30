# Changelog

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
