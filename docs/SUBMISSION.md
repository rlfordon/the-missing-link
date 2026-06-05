# AMO submission — reviewer notes

The AMO reviewer-notes field has a length cap. Paste the **"Reviewer notes (as
submitted)"** section below — it's the condensed version that actually fits. The
longer "Notes for reviewer (long form)" beneath it is the full reference; the
extra detail also lives in PRIVACY.md (linked on the listing) and the repo.

## Reviewer notes (as submitted — 2026-06-05)

```
The Missing Link identifies the U.S. court case discussed on the current web page (via the Anthropic Claude API) and links the user to it on CourtListener. It does nothing without an Anthropic API key.

TEST CREDENTIALS: A temporary Anthropic key is in the private reviewer field. Open the options page (toolbar icon → gear), paste the key, keep the default model (Sonnet 4.6), and save. We will revoke this key after review.

STEPS TO TEST:
1. Paste the key in the options page; save.
2. Open: https://www.theguardian.com/commentisfree/2026/apr/30/supreme-court-voting-rights-act-ruling
3. Click the toolbar icon ("Find on CourtListener").
4. The popup identifies the case and links to it on courtlistener.com.
(Video-led or heavily JS-rendered pages may show "Page is empty" — expected. The article above reads cleanly.)

DATA FLOW: Visible page text (capped at 20,000 chars) and any selection are sent ONLY to api.anthropic.com to identify the case. The returned identifiers (name, docket, court, citation) are sent ONLY to www.courtlistener.com. The API key is stored in browser.storage.local and sent ONLY to api.anthropic.com — never to CourtListener, never logged. No analytics, telemetry, or backend.

PERMISSIONS: The two host permissions are the only hosts contacted. activeTab/storage/contextMenus: read the active tab on user action, store the key + model choice, and offer a right-click action (the only path that works in Firefox's PDF viewer). The <all_urls> content script extracts page text on demand and caches the latest text selection; the cache needs a selectionchange listener live BEFORE the popup opens, because Firefox's popup focus shift clears window.getSelection() on some sites. It reads only visible text/selection and sends nothing — all network calls happen in the background script, to the two hosts above.

innerHTML: the popup renders via template literals; every dynamic value is HTML-escaped via the esc() helper (popup.js:11). Only static developer markup is un-escaped. No unsanitized external data reaches innerHTML.
```

## Notes for reviewer (long form)

This extension identifies the U.S. court case discussed on the current web page
(using the Anthropic Claude API) and links the user straight to it on
CourtListener. It cannot be exercised without an Anthropic API key.

**Test credentials:** A temporary Anthropic API key is provided in the private
reviewer field / below. Paste it into the extension's options page (toolbar icon
→ gear, or right-click the icon → Manage Extension → Preferences), leave the
default model (Sonnet 4.6) selected, and save. (We will revoke this key after
review.)

**Steps to test:**
1. Install and open the options page; paste the provided API key; leave the default model (Sonnet 4.6) selected; save.
2. Open this known-good article (it names a case in plain text):
   https://www.theguardian.com/commentisfree/2026/apr/30/supreme-court-voting-rights-act-ruling
3. Click the toolbar icon ("Find on CourtListener").
4. The popup identifies the case and links to it on courtlistener.com.

(Some pages — e.g. video-led or heavily JavaScript-rendered pages — may show
"Page is empty"; that's expected and not a malfunction. The article above reads
cleanly.)

**Data flow (privacy):**
- The visible page text (capped at 20,000 chars) and any user text selection are
  sent ONLY to `api.anthropic.com`, to identify the case.
- The resulting case identifiers (name, docket number, court, citation) are sent
  ONLY to `www.courtlistener.com`, to find the matching record.
- The user's Anthropic API key is stored in `browser.storage.local` and is sent
  ONLY to `api.anthropic.com`. It is never sent to CourtListener or anywhere else,
  and never logged.
- There is no analytics, telemetry, or backend of any kind.

**Permissions:**
- `https://api.anthropic.com/*`, `https://www.courtlistener.com/*` — the only two
  hosts the extension contacts (declared so the background `fetch` calls are
  CORS-clean).
- `activeTab`, `storage`, `contextMenus` — read the current tab's text on user
  action, store the API key + model choice, and offer a right-click "Find on
  CourtListener" on selected text (the only path that works inside Firefox's PDF
  viewer).
- The `<all_urls>` content script: it extracts the article text on demand and
  maintains a small cache of the user's most recent text selection. The cache
  must be populated by a `selectionchange` listener that is live *before* the
  toolbar popup opens — Firefox's popup-open focus change clears
  `window.getSelection()` on some sites, and the cache is the only fallback. That
  is why the content script is declarative rather than injected on click. It reads
  only visible text and the selection; it sends nothing anywhere (all network
  calls happen in the background script, to the two hosts above).

**On the `innerHTML` validator warnings:** The popup renders its UI via template
literals assigned to `innerHTML`. Every dynamic value — page-derived text, model
output, and CourtListener API fields — is HTML-entity-escaped through the `esc()`
helper (`popup.js:11`) before interpolation (see `formatCaption` and every
`${esc(...)}` call site). The only un-escaped interpolations are short
developer-authored static fragments (`<code>`, `<br>`). No unsanitized external
data reaches `innerHTML`.

## Internal pre-submission checklist
- [ ] Source uses no minifier/bundler/transpiler → answer "No" to the
      "do you use build tools?" question (skips the source-upload requirement).
- [ ] `node --test` passes.
- [ ] Fivehouse repro + 3-model regression sweep done (see docs/TESTS.md).
- [ ] Generate a throwaway, low-limit Anthropic key for the reviewer; paste into
      the AMO reviewer field; calendar a reminder to revoke after approval.
- [ ] Privacy policy (PRIVACY.md) linked in the AMO privacy field.
- [ ] At least one screenshot (popup with a found case).
