# AMO listing metadata

Paste these into the addons.mozilla.org listing form. Reviewer notes and source
package details live in [FIREFOX-update.md](FIREFOX-update.md).

## Name

```text
The Missing Link
```

If you want a more descriptive title and AMO still has room, this also works:

```text
The Missing Link - case finder for CourtListener
```

## Summary

AMO caps this at 250 characters.

```text
Find the case the article did not link. Claude identifies the U.S. court case discussed on the page and links you straight to it on CourtListener. Bring your own Anthropic API key.
```

## Description

```text
The Missing Link finds the U.S. court case discussed on the page you are reading - a news article, blog post, press release, or opinion piece - and links you straight to it on CourtListener.

Click the toolbar button, or right-click selected text. Claude reads the visible page text, identifies the case, and the extension searches CourtListener for the matching opinion, docket, or filing. On a page that discusses several cases, select the passage you care about first to target that one.

WHAT YOU NEED
- An Anthropic API key (console.anthropic.com). For most users, light use is usually cents, not dollars, though heavy use or repeated testing can add up. You paste it once in settings.
- No CourtListener account. Searches are unauthenticated.

CHOOSE YOUR MODEL
Pick the Claude model in settings:
- Sonnet 4.6: balanced, the default
- Haiku 4.5: faster and cheaper
- Opus 4.7: best on tricky or ambiguous cases

PRIVACY
- Visible page text and your selection are sent only to Anthropic, to identify the case.
- The resulting case identifiers are sent only to CourtListener, to find the matching record.
- Your API key is stored locally in your browser and sent only to Anthropic.
- No analytics, no telemetry, and no backend of any kind.

Works on appellate and Supreme Court opinions as well as district-court dockets and filings. Some video-led or heavily script-rendered pages have no readable text to analyze; that is expected, not a malfunction.

Open source: https://github.com/rlfordon/the-missing-link
```

## Categories

- Primary: Search Tools
- Secondary: Feeds, News & Blogging

## Tags / keywords

```text
legal, law, case law, caselaw, court, courts, dockets, CourtListener, legal research, Claude, AI
```

## Support / contact

- Support site: `https://github.com/rlfordon/the-missing-link`
- Support email: optional if a support site is provided

## Privacy policy URL

```text
https://github.com/rlfordon/the-missing-link/blob/main/PRIVACY.md
```

## License

- MIT

## Form answers / flags

- Do you use build tools (minifier / bundler / transpiler)?
  - Answer: `No` for the extension's own app code.
  - Caveat: for `v0.6.0`, we ship a vendored minified third-party polyfill, so
    attach the source package described in
    [FIREFOX-update.md](FIREFOX-update.md).
- Does this add-on require an account or payment on another website?
  - Answer: `Yes` - users need their own Anthropic API key.
- Screenshots
  - Upload at least one screenshot of the popup showing a found case.
  - A second screenshot of the settings page is helpful but optional.
