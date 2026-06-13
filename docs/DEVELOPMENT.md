# Development

## How it works

1. A content script extracts the visible article text and the user's selection, if any.
2. The background worker sends that text to Claude with a forced tool-use schema for `case_name`, `court_id`, `docket_number`, `document_type`, and related fields.
3. With those identifiers, the extension runs a CourtListener search cascade. It chooses RECAP first for trial-court matters and opinions first for appellate/supreme-court matters, then falls back through stricter and looser query variants.
4. The popup renders the top match, up to three alternates, and manual-search fallback links.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest used for both Firefox and Chrome/Chromium. |
| `sw.js` | Tiny MV3 service-worker loader for Chrome. |
| `background.js` | Calls Claude for case extraction, then runs the CourtListener search flow. |
| `search.js` | Pure query-construction, ranking, and plausibility helpers; unit-tested under Node. |
| `content.js` | Extracts visible page text and the user's selection. |
| `popup.html` / `popup.css` / `popup.js` | The popup UI and popup-side control flow. |
| `options.html` / `options.js` | Stores the Anthropic API key and model choice in `browser.storage.local`. |
| `browser-polyfill.min.js` | Vendored `webextension-polyfill` used across contexts. |
| `icons/` | PNG icons plus `generate.py` to regenerate them. |

## Configuration

- **Model.** Users pick Haiku 4.5 / Sonnet 4.6 / Opus 4.7 in the options page; the choice is stored in `browser.storage.local` under key `model` and read by `background.js` on each request. The fallback default is `DEFAULT_MODEL` in `background.js`.
- **Text caps.** `MAX = 20000` chars for the page and `SEL_MAX = 4000` for the selection, both in `content.js`.
- **Search strategy.** `search.js` and `background.js` coordinate a cascade of `strict`, `loose`, `case_name_free`, source-text free-text, and broader fallback queries across the RECAP and opinions indexes.
- **Prompt.** `EXTRACT_SYSTEM` in `background.js` is the most consequential prompt. It controls `document_type` routing, focus-passage behavior, and the extraction guardrails around party naming.

## Reloading during development

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and select `manifest.json`.
3. After edits, click **Reload** on the extension card. For `content.js` changes you may also need to reload the page itself.

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repo folder, or use **Reload** after later edits.
4. If you are testing a page that was already open before reload, refresh the page too.

## Debugging

- Right-click the toolbar icon and inspect the popup to debug `popup.js`.
- In Firefox, the background console is reachable from `about:debugging`.
- In Chrome, open the extension card in `chrome://extensions` and inspect the service worker.

## Regenerating the icon

Icons are produced by `icons/generate.py` (requires Pillow). Tweak the geometry constants at the top of `draw_icon`, then run:

```sh
python icons/generate.py
```

It writes the icon PNGs into `icons/`.

## Notes

- The Chrome popup now has an on-demand content-script injection retry path for pages where Chrome says `Receiving end does not exist`.
- `search.js` is intentionally pure and exportable so `node --test tests/search.test.js` can exercise the query/ranking logic without a browser.
- `docs/test-links.html` is a lightweight manual-test launcher for the article matrix in `docs/TESTS.md`.

## Editing in Claude Code

If you're using Claude Code in this repo, see [`../CLAUDE.md`](../CLAUDE.md) for architectural notes and gotchas.
