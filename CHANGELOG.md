# Changelog

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
