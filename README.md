# The Missing Link

*Find the case the article didn't link.*

A Firefox extension that reads the article you're on, identifies the case being discussed, and links you straight to it on [CourtListener](https://www.courtlistener.com).

Click the toolbar button while reading a news article, blog post, or opinion piece. Claude reads the page, identifies the case (parties, court, docket number, citation), and the extension searches CourtListener for the match — usually returning a direct link to the opinion or RECAP docket in a few seconds.

When the page discusses multiple cases, select the passage about the case you want and click. The selection becomes the focus; the rest of the page is used as context for disambiguation.

## Install

*AMO listing coming soon.* For now, install from a release:

1. Download the latest **Source code (zip)** from the [releases page](https://github.com/rlfordon/the-missing-link/releases/latest).
2. Unzip it somewhere on your computer.
3. In Firefox, open `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on…** and select `manifest.json` from the unzipped folder.

The extension stays loaded until Firefox restarts — reload it from `about:debugging` after each Firefox restart.

### Or clone the source

If you'd rather work from the latest `main` (e.g., for development or to pick up fixes between releases), clone the repo and load `manifest.json` from there the same way:

```sh
git clone https://github.com/rlfordon/the-missing-link.git
```

## Setup

1. Get an Anthropic API key at [console.anthropic.com](https://console.anthropic.com/settings/keys).
2. Click the ⚙ button in the popup and paste your key.

The CourtListener search API is queried unauthenticated — no CourtListener account needed.

## Usage

- **Whole page mode:** click the toolbar button on any article. The whole page goes to Claude.
- **Focus mode:** select a passage first, then click. The selection is treated as the case to identify; the rest of the page is context.

The popup shows a confidence chip on the top match — if it says "low," trust the result less.

## Privacy

- Your Anthropic key lives only in `browser.storage.local` on your machine.
- Page text (capped at 20,000 chars) is sent to `api.anthropic.com` on each click.
- Case identifiers are sent to `www.courtlistener.com`.
- Nothing else leaves the browser. There is no telemetry, no analytics, no backend.

## Limitations

- **Firefox only.** MV2 works in Firefox but not Chrome (which is MV3-only).
- **Single case per click.** If a page discusses multiple cases and you don't select one, you'll get whichever case Claude weighted highest. Use focus mode for the rest.
- **Won't find what isn't on CourtListener.** State trial-court filings and very recent matters may not be in RECAP yet.
- **Costs Anthropic API tokens.** A fraction of a cent to a few cents per click, depending on the model.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture, configuration knobs, and source layout.

## License

[MIT](LICENSE). Personal-scale tool. Firefox 109+.
