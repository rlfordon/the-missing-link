# Chrome Web Store submission copy

Use this for the first Chrome Web Store listing of `v0.6.0`.

## Name

```text
The Missing Link
```

## Short description

```text
Find the case the article did not link. Claude identifies the case discussed on the page and opens the matching CourtListener record.
```

## Description

```text
The Missing Link finds the U.S. court case discussed on the page you are reading and links you straight to it on CourtListener.

Click the toolbar button, or right-click selected text. Claude reads the visible page text, identifies the case, and the extension searches CourtListener for the matching opinion, docket, or filing. On a page that discusses several cases, select the passage you care about first to target that one.

WHAT YOU NEED
- Your own Anthropic API key (console.anthropic.com)
- Light use is usually cents, not dollars, though heavy use or repeated testing can add up
- No CourtListener account

MODEL CHOICE
- Sonnet 4.6: balanced, the default
- Haiku 4.5: faster and cheaper
- Opus 4.7: best on difficult or ambiguous pages

PRIVACY
- Visible page text and your selection are sent only to Anthropic, to identify the case.
- Resulting case identifiers are sent only to CourtListener, to find the matching record.
- Your Anthropic API key is stored locally in your browser and sent only to Anthropic.
- No analytics, telemetry, ads, or backend.

Some video-led or heavily script-rendered pages do not expose readable article text. In those cases the extension may say the page is empty.

Open source: https://github.com/rlfordon/the-missing-link
```

## Single purpose

Use this in the Chrome privacy tab's single-purpose field:

```text
Identify the U.S. court case discussed on the current page and open the matching CourtListener record.
```

## Permission justifications

Use these in the Chrome privacy tab for manifest permissions and host access.

- `activeTab`
  - Read the current tab only after a user click or context-menu action so the
    extension can extract the page text to analyze.
- `scripting`
  - Inject the packaged local content script on demand after a user gesture so
    the extension can read the current page without declaring broad page host
    permissions in the manifest.
- `storage`
  - Store the user's Anthropic API key and chosen model locally in the browser.
- `contextMenus`
  - Add the right-click "Find on CourtListener" action for selected text.
- `https://api.anthropic.com/*`
  - Send page text, selection text, and the user's Anthropic API key to
    Anthropic so Claude can identify the case discussed.
- `https://www.courtlistener.com/*`
  - Search CourtListener using the returned case identifiers and open the
    matching docket, opinion, or document.

## Host permission justification

Use this if Chrome asks for one combined host-permission explanation:

```text
The extension does not request broad page host permissions. It uses activeTab plus on-demand local script injection after a user click to read only the current page the user asked about. It needs host access to https://api.anthropic.com/* to send page text and any selected passage for case identification, and to https://www.courtlistener.com/* to search for and open the matching docket, opinion, or document. No analytics, ads, or unrelated tracking use these hosts.
```

## Privacy tab answers

These fields change over time, so treat this as the intended substance rather
than a guarantee of the exact checkbox wording.

- Data collected
  - `Website content`: Yes
  - `Authentication information`: Yes, for the user's Anthropic API key
- Purpose of data use
  - Core functionality only
- Data sale
  - No
- Data used for advertising
  - No
- Data used for unrelated purposes
  - No

## Test instructions

Chrome's official guidance says this field is optional and mainly useful when a
reviewer needs credentials. Use this if you decide to provide a temporary key.

```text
This extension identifies the U.S. court case discussed on the current page and links to the matching CourtListener record.

TEST CREDENTIALS
A temporary Anthropic API key is provided in the reviewer-only field. Open the settings page from the popup gear button, paste the key, leave the default model selected, and save.

STEPS
1. Open the extension settings and paste the temporary Anthropic key.
2. Visit https://www.eeoc.gov/newsroom/jag-physical-therapy-pay-125000-eeoc-pregnancy-discrimination-lawsuit
3. Click the toolbar button.
4. The popup should identify U.S. Equal Employment Opportunity Commission v. PT Administrative Services LLC and link to CourtListener.
```

## Manual assets still needed

Chrome requires more than the ZIP package. Before submitting, prepare:

- at least one real screenshot of the extension in use
- one small promotional image for the store listing
  - ready-made file in this repo:
    `docs/store-assets/chrome-small-promo-440x280.png`
- optional extra screenshots if you want a stronger listing

Suggested first screenshot:

- popup showing a successful match on the EEOC JAG Physical Therapy page

Suggested second screenshot:

- options page with the API-key field visible but blank
