# AMO submission — reviewer notes

Paste the "Notes for reviewer" section into the AMO submission form. The rest is
internal checklist.

## Notes for reviewer

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

## Internal pre-submission checklist
- [ ] Source uses no minifier/bundler/transpiler → answer "No" to the
      "do you use build tools?" question (skips the source-upload requirement).
- [ ] `node --test` passes.
- [ ] Fivehouse repro + 3-model regression sweep done (see docs/TESTS.md).
- [ ] Generate a throwaway, low-limit Anthropic key for the reviewer; paste into
      the AMO reviewer field; calendar a reminder to revoke after approval.
- [ ] Privacy policy (PRIVACY.md) linked in the AMO privacy field.
- [ ] At least one screenshot (popup with a found case).
