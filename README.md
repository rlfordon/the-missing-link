# The Missing Link

*Find the case the article didn't link.*

A browser extension that finds the case discussed on a web page and links you straight to it on [CourtListener](https://www.courtlistener.com). Click the toolbar button, Claude identifies the case, and the extension searches CourtListener for the match.

> **Status:** Chrome Web Store carries `v0.6.0` at [chromewebstore.google.com](https://chromewebstore.google.com/detail/the-missing-link/keabioafoggdllieldimckfijklbdoii), and Firefox Add-ons now also carries `v0.6.0` at [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/the-missing-link/).

## Install

Install from Chrome Web Store:

<https://chromewebstore.google.com/detail/the-missing-link/keabioafoggdllieldimckfijklbdoii>

Or from Firefox Add-ons:

<https://addons.mozilla.org/en-US/firefox/addon/the-missing-link/>

### Or install from source

For development or to pick up fixes between releases:

1. Download **Source code (zip)** from the [latest release](https://github.com/rlfordon/the-missing-link/releases/latest), or clone the repo:

   ```sh
   git clone https://github.com/rlfordon/the-missing-link.git
   ```

2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...** and select `manifest.json` from the unzipped or cloned folder.

Temporary add-ons stay loaded until Firefox restarts. Re-load it from `about:debugging` after each restart.

To test in Chrome/Chromium:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repo folder.

## Setup

1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com/settings/keys). For most users, a few dollars of credit should last quite a while; light use is usually cents, not dollars.
2. Click the toolbar icon -> Settings -> paste your key. While you're there, pick a model:

   - **Sonnet 4.6** - balanced, default
   - **Haiku 4.5** - faster and cheaper, occasionally less accurate
   - **Opus 4.7** - best on tricky or ambiguous cases, most expensive

CourtListener is queried unauthenticated, so no CL account is needed.

## Usage

- **Whole-page mode:** click the toolbar button on any article. The whole page text goes to Claude.
- **Focus mode:** select a passage first, then click. The selection is treated as the case to identify; the rest of the page is context for disambiguation.

The popup shows a **confidence chip** on the top match. If it says "low," trust the result less. Below the primary result button, a **copy link** affordance puts the URL on your clipboard without closing the popup.

## Tester Feedback

Most useful things to flag:

- **Confidently wrong results.** The popup says "high" or "medium confidence" but the case is not what the article describes.
- **Articles where the popup shows "Page is empty."** Helps track which sites' DOM the content script cannot read.
- **Focus mode misses.** You selected a passage about case X, and the popup returned case Y.
- **UI or wording confusion.** Anything unclear in the popup, settings, empty states, or error messages.

## Limitations

- **Store rollouts can land at different times.** Both public listings are currently on `v0.6.0`, but one store may occasionally approve an update before the other.
- **Single case per click.** If a page discusses multiple cases and you do not select one, you get whichever case Claude weighted highest.
- **Won't find what isn't on CourtListener.** State trial-court filings and very recent matters may not be in RECAP yet.
- **Smaller models can hallucinate confidently** on articles where the case is not clearly named. If you suspect a wrong answer, switch to Opus in settings and re-run.
- **Some video-led pages** do not expose article text in a way the content script can read; the popup will show "Page is empty."
- **Costs Anthropic API tokens.** Light use is usually cents, not dollars, but heavy use or repeated testing can add up quickly, especially on Opus.

## Privacy

- Your Anthropic key lives only in `browser.storage.local` on your machine.
- Page text (capped at 20,000 chars) is sent to `api.anthropic.com` on each click.
- Case identifiers are sent to `www.courtlistener.com`.
- Nothing else leaves the browser. There is no telemetry, analytics, or backend.

## Development

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for architecture, configuration knobs, and source layout. Other dev notes (`docs/BACKLOG.md`, `docs/TESTS.md`, `docs/test-links.html`) live alongside it.

## Thanks

Thanks to Tony Rowles ([`@tonyrowles`](https://github.com/tonyrowles)) for the Chrome port and PR `#4`.

## License

[MIT](LICENSE) © 2026 Rebecca Fordon. Personal-scale tool.
