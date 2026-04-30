# The Missing Link

*Find the case the article didn't link.*

A Firefox extension that finds the case discussed on a web page (a news article, blog post, opinion piece) and links you straight to it on [CourtListener](https://www.courtlistener.com). Click the toolbar button — Claude identifies the case and the extension searches CourtListener for the match, usually in a few seconds.

> **Status: pre-AMO beta.** Looking for testers. See [Tester feedback](#tester-feedback) below for what's most useful to flag. Requires Firefox 109+.

## Install

*AMO listing coming soon.* For now:

1. Download **Source code (zip)** from the [latest release](https://github.com/rlfordon/the-missing-link/releases/latest).
2. Unzip it somewhere on your computer.
3. In Firefox, open `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on…** and select `manifest.json` from the unzipped folder.

The extension stays loaded until Firefox restarts — re-load it from `about:debugging` after each restart.

### Or clone the source

For development or to pick up fixes between releases:

```sh
git clone https://github.com/rlfordon/the-missing-link.git
```

Then load `manifest.json` from the cloned folder the same way as steps 3–4 above.

## Setup

1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com/settings/keys). A few dollars of credit lasts hundreds of clicks.
2. Click the toolbar icon → ⚙ **Settings** → paste your key. While you're there, pick a model:

   - **Sonnet 4.6** — balanced, default
   - **Haiku 4.5** — faster and cheaper, occasionally less accurate
   - **Opus 4.7** — best on tricky/ambiguous cases, most expensive

CourtListener is queried unauthenticated — no CL account needed.

## Usage

- **Whole-page mode:** click the toolbar button on any article. The whole page text goes to Claude.
- **Focus mode:** select a passage first, then click. The selection is treated as the case to identify; the rest of the page is context for disambiguation.

The popup shows a **confidence chip** on the top match — if it says "low," trust the result less. Below the primary "Open on CourtListener" button, a **copy link** affordance puts the URL on your clipboard without closing the popup.

## Tester feedback

Most useful things to flag (Issues tab on the repo, or message me directly):

- **Confidently wrong results.** The popup says "high" or "medium confidence" but the case isn't what the article describes. The worst failure mode and the highest-priority bug to know about.
- **Articles where the popup shows "Page is empty."** Helps me track which sites' DOM the content script can't read.
- **Focus mode misses.** You selected a passage about case X, the popup returned case Y. Especially useful when the focus passage *describes* a case but doesn't *name* it.
- **UI or wording confusion.** Anything unclear in the popup, settings, empty states, or error messages.

## Limitations

- **Firefox only.** MV2 works in Firefox but not Chrome (which is MV3-only).
- **Single case per click.** If a page discusses multiple cases and you don't select one, you'll get whichever case Claude weighted highest. Use focus mode for the rest.
- **Won't find what isn't on CourtListener.** State trial-court filings and very recent matters may not be in RECAP yet.
- **Smaller models can hallucinate confidently** on articles where the case isn't clearly named. If you suspect a wrong answer, switch to Opus in settings and re-run.
- **Some video-led pages** (PBS NewsHour-style transcripts) don't expose article text in a way the content script can read — the popup will show "Page is empty."
- **Costs Anthropic API tokens.** A fraction of a cent to a few cents per click, depending on the model.

## Privacy

- Your Anthropic key lives only in `browser.storage.local` on your machine.
- Page text (capped at 20,000 chars) is sent to `api.anthropic.com` on each click.
- Case identifiers are sent to `www.courtlistener.com`.
- Nothing else leaves the browser. There is no telemetry, no analytics, no backend.

## Development

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for architecture, configuration knobs, and source layout. Other dev notes (`docs/BACKLOG.md`, `docs/TESTS.md`) live alongside it.

## License

[MIT](LICENSE) © 2026 Rebecca Fordon. Personal-scale tool.
