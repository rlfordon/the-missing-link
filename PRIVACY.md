# Privacy Policy — The Missing Link

_Last updated: 2026-06-05_

The Missing Link is a Firefox extension that identifies the U.S. court case
discussed on a web page and links to it on CourtListener. It has no backend,
no account system, and collects no analytics or telemetry.

## What data is processed, and where it goes

- **Page text and text selections.** When you click the toolbar button (or use
  the right-click "Find on CourtListener" menu), the visible text of the current
  page (capped at 20,000 characters) and your current text selection are sent to
  the Anthropic Claude API (`api.anthropic.com`) for the sole purpose of
  identifying the case discussed. This text is not sent anywhere else and is not
  stored by the extension.

- **Case identifiers.** The case name, docket number, court, and citation that
  Claude returns are sent to CourtListener (`www.courtlistener.com`) to find the
  matching record. No page text is sent to CourtListener.

- **Your Anthropic API key.** The key you enter is stored locally in your browser
  (`browser.storage.local`) and is transmitted only to `api.anthropic.com` to
  authenticate your requests. It is never sent to CourtListener, never sent to any
  other party, and never logged.

## What we do not do

- No analytics, tracking, advertising, or telemetry.
- No data is sent to the developer or any server we control (there is no such
  server).
- No data is shared or sold.

## Third parties

Your use of the Anthropic API and CourtListener is subject to their respective
privacy policies:
- Anthropic: https://www.anthropic.com/legal/privacy
- CourtListener (Free Law Project): https://www.courtlistener.com/terms/

## Contact

Questions: open an issue at https://github.com/rlfordon/the-missing-link
