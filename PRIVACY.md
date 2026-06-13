# Privacy Policy - The Missing Link

_Last updated: 2026-06-12_

The Missing Link is a browser extension that identifies the U.S. court case
discussed on the page you are reading and links you to it on CourtListener. It
has no backend, no account system, and no analytics or telemetry.

## What data is processed, and where it goes

- **Page text and text selections.** When you click the toolbar button or use
  the right-click "Find on CourtListener" menu item, the visible text of the
  current page (capped at 20,000 characters) and your current text selection
  are sent to the Anthropic API (`api.anthropic.com`) for the sole purpose of
  identifying the case discussed. This text is not sent anywhere else by the
  extension.

- **Case identifiers.** The case name, docket number, court, citation, and
  related search hints returned from Anthropic are sent to CourtListener
  (`www.courtlistener.com`) so the extension can find the matching docket,
  opinion, or document. No page text is sent to CourtListener.

- **Your Anthropic API key.** The API key you enter is stored locally in your
  browser (`browser.storage.local`) and is transmitted only to
  `api.anthropic.com` to authenticate your requests. It is never sent to
  CourtListener, never sent to any server we control, and never logged by the
  extension.

## What we do not do

- No analytics, tracking, advertising, or telemetry.
- No data is sent to the developer or any server we control.
- No data is shared or sold.

## Third parties

Your use of Anthropic and CourtListener is also subject to their own terms and
privacy practices:

- Anthropic: <https://www.anthropic.com/legal/privacy>
- CourtListener / Free Law Project: <https://www.courtlistener.com/terms/>

## Contact

Questions or concerns: open an issue at
<https://github.com/rlfordon/the-missing-link>
