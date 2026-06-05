# AMO listing metadata

Paste these into the addons.mozilla.org listing form. (Reviewer notes live separately in `SUBMISSION.md`.)

---

## Name
```
The Missing Link
```
*(If you want it more discoverable, AMO allows up to 50 chars — e.g. `The Missing Link — case finder for CourtListener`.)*

## Summary
*(AMO max 250 chars; this is ~180.)*
```
Find the case the article didn't link. Claude identifies the U.S. court case discussed on the page and links you straight to it on CourtListener. Bring your own Anthropic API key.
```

## Description
```
The Missing Link finds the U.S. court case discussed on the page you're reading — a news article, blog post, or opinion piece — and links you straight to it on CourtListener.

Click the toolbar button (or right-click a text selection). Claude reads the visible page text, identifies the case, and the extension searches CourtListener for the matching opinion or docket — usually in a few seconds. On a page that discusses several cases, select the passage you care about first to target that one.

WHAT YOU NEED
• An Anthropic API key (console.anthropic.com). A few dollars of credit lasts hundreds of lookups. You paste it once in the extension's settings.
• No CourtListener account — searches are unauthenticated.

CHOOSE YOUR MODEL
Pick the Claude model in settings: Sonnet 4.6 (balanced, the default), Haiku 4.5 (faster and cheaper), or Opus 4.7 (best on tricky or ambiguous cases).

PRIVACY
• The visible page text and your selection are sent only to Anthropic, to identify the case.
• The resulting case identifiers (name, docket number, court, citation) are sent only to CourtListener, to find the record. No page text goes to CourtListener.
• Your API key is stored locally in your browser and sent only to Anthropic — never logged, never shared, never sent anywhere else.
• No analytics, no telemetry, no backend of any kind.

Works on appellate and Supreme Court opinions as well as district-court dockets. Some video-led or heavily script-rendered pages have no readable text to analyze; that's expected, not a malfunction.

Open source: https://github.com/rlfordon/the-missing-link
```

## Categories
- **Primary:** Search Tools
- **Secondary:** Feeds, News & Blogging  *(it's used on news articles; "Other" also works if you prefer)*

## Tags / keywords
```
legal, law, case law, caselaw, court, courts, dockets, CourtListener, legal research, Claude, AI
```

## Support / contact
- **Support site:** `https://github.com/rlfordon/the-missing-link`
- **Support email:** *(your address, optional if a support site is given)*

## Privacy policy URL
```
https://github.com/rlfordon/the-missing-link/blob/main/PRIVACY.md
```

## License
- **MIT** (per `LICENSE`, © 2026 Rebecca Fordon) — select MIT in the AMO license dropdown.

## Form answers / flags
- **Do you use build tools (minifier/bundler/transpiler)?** → **No.**
- **Does this add-on require an account or payment on another website?** → **Yes** — it requires the user's own Anthropic API key (a paid third-party API). Note this in the field so reviewers aren't surprised that it does nothing until a key is entered.
- **Screenshots:** at least one of the popup showing a found case (e.g. the Guardian → *Louisiana v. Callais* result). A second showing the settings/API-key page is helpful.
