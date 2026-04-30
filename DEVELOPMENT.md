# Development

## How it works

1. Content script extracts the visible article text (and your selection, if any).
2. Background script sends the text to Claude with a prompt asking for structured JSON: `case_name`, `court_id`, `docket_number`, `document_type`, etc.
3. With those identifiers, the extension runs a cascade of queries against CourtListener's public search API — RECAP first if Claude flagged a trial-court matter, opinions first otherwise — and falls back through looser variants if the strict query returns nothing.
4. The popup renders the top match with a direct link, plus up to three alternates and a "search manually" fallback.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV2 manifest. Host permissions for `api.anthropic.com` and `www.courtlistener.com`. |
| `background.js` | Calls Claude for case extraction, then runs the search cascade against CourtListener. |
| `content.js` | Extracts visible page text and the user's selection. |
| `popup.html` / `popup.css` / `popup.js` | The popup UI. |
| `options.html` / `options.js` | Stores the Anthropic API key in `browser.storage.local`. |
| `icons/` | PNG icons (48 / 96 / 128) plus `generate.py` to regenerate them. |

## Configuration

A few things worth knowing if you want to tweak:

- **Model.** `CLAUDE_MODEL` in `background.js` defaults to `claude-haiku-4-5-20251001` — cheap and fast for structured JSON extraction. For higher quality on tricky cases, try `claude-sonnet-4-6` or `claude-opus-4-7`.
- **Text caps.** `MAX = 20000` chars for the page, `SEL_MAX = 4000` for the selection, both in `content.js`. Raise for very long articles.
- **Search strategy.** The cascade in `background.js` (`searchCourtListener`) tries RECAP-first or opinions-first based on Claude's `document_type` hint, then falls back through `strict → loose → free` query variants. The `strict` variant uses the `court` filter; `loose` drops it (in case the model guessed the court ID wrong); `free` falls back to free-text `q=`.
- **Prompt.** `EXTRACT_SYSTEM` in `background.js`. The most consequential lines are the rules for `document_type` (which routes search between CL's two indexes) and the focus-passage instructions (which tell Claude to resolve a user-selected passage rather than the page's most prominent case).

## Reloading during development

After editing source, click **Reload** on the extension card in `about:debugging#/runtime/this-firefox`. A full reload is needed for `background.js` and `manifest.json` changes; for `content.js` changes you may also need to reload the page you're testing on, since the old content script is still injected there.

Right-click the toolbar icon → **Inspect** to open devtools for the popup. The background script's console is reachable via the **Inspect** link in `about:debugging`.

## Regenerating the icon

Icons are produced by `icons/generate.py` (requires Pillow). Tweak the geometry constants at the top of `draw_icon`, then run:

```sh
python icons/generate.py
```

It writes `icon-48.png`, `icon-96.png`, and `icon-128.png` to the `icons/` directory.

## Porting to Chrome (MV3)

Replace `browser.` with `chrome.` (or use a polyfill), convert `manifest.json` to MV3, move `background.js` to a service worker. The Anthropic and CourtListener `fetch` calls themselves don't change.

## Editing in Claude Code

If you're using Claude Code in this repo, see [`CLAUDE.md`](CLAUDE.md) for architectural notes and gotchas — including the duplicate `buildCLSearchURL` definition in `background.js` that's easy to edit by mistake.
