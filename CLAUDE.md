# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

Firefox WebExtension (MV2) — plain JavaScript, no build step, no package manager, no tests. Edit files in place and reload the extension in `about:debugging` to see changes. Source files (`background.js`, `content.js`, `popup.js`, `options.js`, `manifest.json`) are loaded directly by Firefox.

## Loading and reloading during development

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. **Load Temporary Add-on…** → select `manifest.json`.
3. After edits, click **Reload** on the extension card. A full reload is needed for `background.js` and `manifest.json` changes; for `content.js` changes you may also need to reload the *page* you're testing on, since the old content script is still injected there.
4. Right-click the toolbar icon → **Inspect** to open devtools for the popup. The background script's console is reachable via the **Inspect** link in `about:debugging`.

## Architecture: three execution contexts, message-passed

The extension splits across three sandboxes that can't share memory and communicate only via `browser.runtime.sendMessage` / `browser.tabs.sendMessage`. Understanding which context owns which capability is the main thing:

- **`content.js`** runs in the page's context. Has DOM access. Extracts visible article text (`pickRoot` → `<article>` / `<main>` / fallback) and the user's text selection. Maintains a `lastSelection` cache because Firefox's popup-open focus shuffle wipes `window.getSelection()` on some sites — the cache is the fallback path.
- **`popup.js`** runs in the popup. Orchestrates: gets active tab → `tabs.sendMessage(GRAB_PAGE)` to content script → `runtime.sendMessage(FIND_CASE)` to background → renders result. No direct DOM access to the page.
- **`background.js`** runs in the event page. Has host permissions for `api.anthropic.com` and `www.courtlistener.com`, so `fetch` to those domains is CORS-free here (and only here). Calls Claude, then runs the CourtListener search cascade.

The popup is the only piece that talks to both other contexts; content and background never message each other directly.

## Two pieces of architecture that aren't obvious from skimming

**1. CourtListener has two indexes, and routing between them is the most consequential decision.** `type=o` is the Opinions index (appellate / SCOTUS published opinions). `type=r` is RECAP (district-court dockets, orders, filings). A district-court summary judgment ruling will *not* show up in opinions search, and an appellate opinion will *not* show up in RECAP. The extraction prompt's `document_type` field is the routing signal — that's why `EXTRACT_SYSTEM` in `background.js` is unusually emphatic about the rule (district-court anything → not "opinion"). When tweaking the prompt, preserve that distinction or search will quietly miss matches.

**2. The search is a cascade, not a single query.** `searchCourtListener` in `background.js` tries `(type, strategy)` pairs in order until one returns results. The two axes:
- **type order** — `prefersRecap` (driven by `document_type` or presence of a docket number) decides whether to try RECAP first or Opinions first.
- **strategy** — `strict` (case_name + court + docket + citation) → `loose` (drops `court` filter, in case Claude guessed `court_id` wrong, which is a common failure mode) → `free` (free-text `q=` only, last-ditch).

Identical URLs (e.g. when `court_id` is null and strict/loose collapse) are deduped via `triedURLs`.

## Known oddity: duplicate `buildCLSearchURL` in background.js

`background.js` defines `buildCLSearchURL` twice (around lines 105 and 124). The second definition shadows the first; the cascade calls the second (which takes a `strategy` parameter). The first is dead code. If you edit URL-building logic, edit the *second* one, and consider deleting the first.

## Editing the extraction prompt

`EXTRACT_SYSTEM` in `background.js` is the contract between Claude and the rest of the pipeline. Downstream code reads these fields by name and treats them as load-bearing:

- `is_case` gates everything (false short-circuits to a "no case detected" UI).
- `document_type` drives `prefersRecap` in the search cascade and `recapFirst` in the popup's empty-state fallback links.
- `case_name`, `docket_number`, `court_id`, `citation` map directly to CourtListener query params.
- `confidence` is rendered as a chip in the popup.
- `query_hints` and `parties` are fallbacks for the free-text `q=` query and the empty-state "search manually" link.

If you add a field, also update consumers in `popup.js` and `background.js`. If you rename a field, search both files.

## Configuration knobs (no build, just constants)

- **Model.** Users pick from radios in the options page (Haiku 4.5 / Sonnet 4.6 / Opus 4.7). Stored in `browser.storage.local` under key `model`, read by `background.js` on each request and passed into `extractCaseInfo`. `DEFAULT_MODEL` in `background.js` is the fallback when nothing is set (currently `claude-sonnet-4-6`).
- **Text caps.** `MAX = 20000` (page) and `SEL_MAX = 4000` (selection) in `content.js`.
- **Anthropic header.** `anthropic-dangerous-direct-browser-access: true` is required for direct browser calls and must stay set.

## Privacy invariants worth preserving

- API key is read from `browser.storage.local` only. It's never logged, never sent to CourtListener, never sent anywhere except `api.anthropic.com`.
- Page text goes only to Anthropic; case identifiers go only to CourtListener. There is no telemetry, analytics, or backend. Don't add any without an explicit ask.

## Porting to Chrome (MV3)

Not done yet, but the README calls it straightforward: replace `browser.` with `chrome.` (or use a polyfill), convert `manifest.json` to MV3, move `background.js` to a service worker. The Anthropic and CourtListener `fetch` calls themselves don't change.
