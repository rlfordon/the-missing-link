# The Missing Link

A Firefox extension that finds the case discussed on a web page and links you straight to it on [CourtListener](https://www.courtlistener.com).

Click the toolbar button while reading a news article, blog post, or opinion piece. Claude reads the page, identifies the case (parties, court, docket number, citation), and the extension searches CourtListener for the match — usually returning a direct link to the opinion or RECAP docket in a few seconds.

When the page discusses multiple cases, select the passage about the case you want and click. The selection becomes the focus; the rest of the page is used as context for disambiguation.

## How it works

1. Content script extracts the visible article text (and your selection, if any).
2. Background script sends the text to Claude with a prompt asking for structured JSON: `case_name`, `court_id`, `docket_number`, `document_type`, etc.
3. With those identifiers, the extension runs a cascade of queries against CourtListener's public search API — RECAP first if Claude flagged a trial-court matter, opinions first otherwise — and falls back through looser variants if the strict query returns nothing.
4. The popup renders the top match with a direct link, plus up to three alternates and a "search manually" fallback.

## Setup

1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Install the extension (see below).
3. Click the ⚙ button in the popup and paste your key.

The CourtListener search API is queried unauthenticated — no CourtListener account needed.

## Install (temporary, for testing)

1. Clone this repo:

   ```sh
   git clone https://github.com/rlfordon/the-missing-link.git
   ```

2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `manifest.json` from the cloned directory.

The extension stays loaded until Firefox restarts. For persistent install, package as `.xpi` and either submit to AMO or use Firefox Developer Edition / Nightly with `xpinstall.signatures.required` set to `false`.

## Usage

- **Whole page mode:** click the toolbar button on any article. The whole page goes to Claude.
- **Focus mode:** select a passage first, then click. The selection is treated as the case to identify; the rest of the page is context.

The popup shows a confidence chip on the top match — if it says "low," trust the result less. The footer reports diagnostics (number of search attempts, which CL index matched).

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV2 manifest. Host permissions for `api.anthropic.com` and `www.courtlistener.com`. |
| `background.js` | Calls Claude for case extraction, then runs the search cascade against CourtListener. |
| `content.js` | Extracts visible page text and the user's selection. |
| `popup.html` / `popup.css` / `popup.js` | The popup UI. |
| `options.html` / `options.js` | Stores the Anthropic API key in `browser.storage.local`. |
| `icons/` | 48px and 96px PNG icons. |

## Configuration

A few things worth knowing if you want to tweak:

- **Model.** `CLAUDE_MODEL` in `background.js` defaults to `claude-opus-4-7`. For this task — extract structured JSON from an article — `claude-haiku-4-5-20251001` is roughly 10x cheaper with negligible quality loss. Sonnet 4.6 sits in between.
- **Text caps.** `MAX = 20000` chars for the page, `SEL_MAX = 4000` for the selection, both in `content.js`. Raise for very long articles.
- **Search strategy.** The cascade in `background.js` (`searchCourtListener`) tries RECAP-first or opinions-first based on Claude's `document_type` hint, then falls back through `strict → loose → free` query variants. The `strict` variant uses the `court` filter; `loose` drops it (in case the model guessed the court ID wrong); `free` falls back to free-text `q=`.
- **Prompt.** `EXTRACT_SYSTEM` in `background.js`. The most consequential lines are the rules for `document_type` (which routes search between CL's two indexes) and the focus-passage instructions (which tell Claude to resolve a user-selected passage rather than the page's most prominent case).

## Privacy

- Your Anthropic key lives only in `browser.storage.local` on your machine.
- Page text (capped at 20,000 chars) is sent to `api.anthropic.com` on each click.
- Case identifiers are sent to `www.courtlistener.com`.
- Nothing else leaves the browser. There is no telemetry, no analytics, no backend.

## Limitations

- **Firefox only.** MV2 works in Firefox but not Chrome (which is MV3-only). Porting is straightforward — replace `browser.` with `chrome.` (or use a polyfill), convert the manifest to MV3 with a service worker.
- **Single case per click.** If a page discusses multiple cases and you don't select one, you'll get whichever case Claude weighted highest. Use focus mode for the rest.
- **Won't find what isn't on CourtListener.** State trial-court filings and very recent matters may not be in RECAP yet.
- **Costs Anthropic API tokens.** Pennies per click at Opus rates, fractions of a cent at Haiku.

## Status

Personal-scale tool. Works on Firefox 109+. No official build, no AMO listing — install temporarily via `about:debugging` or package as `.xpi` yourself.

## License

[MIT](LICENSE).
