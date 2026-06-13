# Firefox AMO update notes

Use this for the AMO update from `v0.5.0` to `v0.6.0`.

## Version summary

`v0.6.0` keeps the same core behavior but updates the extension architecture and
search pipeline:

- migrates the shared source tree to Manifest V3
- adds Chrome / Chromium compatibility
- switches to `action` and adds a service-worker loader (`sw.js`)
- vendors Mozilla's `webextension-polyfill` for Chrome Promise API support
- raises Firefox `strict_min_version` to `121.0`
- switches page access to `activeTab` plus on-demand script injection instead of declarative manifest-wide `content_scripts`
- improves case-name / party matching and result ranking
- shows document filed dates in the popup when CourtListener returns them

## Reviewer notes

Paste this into AMO's reviewer-notes field, then add a temporary Anthropic key
in AMO's private reviewer field if you want them to exercise the extension.

```text
The Missing Link identifies the U.S. court case discussed on the current web page (via the Anthropic API) and links the user to it on CourtListener. It still requires the user's own Anthropic API key to function.

This update moves the extension to a shared Manifest V3 source tree so the same codebase can run in Firefox and Chrome. The current manifest now avoids broad declarative page access: instead of manifest-wide content_scripts, it uses activeTab plus on-demand script injection after a user click. On Chrome, the same manifest also declares a service worker loader plus a vendored copy of Mozilla's webextension-polyfill so the Promise-based browser API continues to work.

TEST CREDENTIALS: If a temporary Anthropic key is provided in the reviewer-only field, open the settings page from the popup gear button, paste the key, keep the default model (Sonnet 4.6), and save.

STEPS TO TEST
1. Paste the temporary key into settings and save.
2. Open: https://www.eeoc.gov/newsroom/jag-physical-therapy-pay-125000-eeoc-pregnancy-discrimination-lawsuit
3. Click the toolbar button.
4. The popup should identify U.S. Equal Employment Opportunity Commission v. PT Administrative Services LLC and link to CourtListener.

DATA FLOW: Visible page text (capped at 20,000 chars) and any selection are sent only to api.anthropic.com to identify the case. The returned identifiers are sent only to www.courtlistener.com to find the matching record. The API key is stored in browser.storage.local and sent only to api.anthropic.com. No analytics, telemetry, ads, or backend.

PERMISSIONS: activeTab is used to read the current page only on user action. scripting injects the packaged local content script on demand instead of relying on broad declarative page host access. storage stores the API key and model choice locally. contextMenus adds the selected-text lookup entry. host_permissions are limited to api.anthropic.com and www.courtlistener.com. Firefox's built-in website-content disclosure is declared in manifest.json.

THIRD-PARTY CODE: This version includes browser-polyfill.min.js, identified in the vendored file header as Mozilla webextension-polyfill v0.12.0. We are attaching a source package and upstream links for reviewer convenience.
```

## Source package note

Because `v0.6.0` includes a vendored minified third-party polyfill
(`browser-polyfill.min.js`), attach the source ZIP produced by
`scripts/package-submission.ps1` if AMO asks whether source code is required.

## Third-party library links

Include these in AMO's "Notes for Reviewers" if helpful:

- Project: <https://github.com/mozilla/webextension-polyfill>
- Tagged source tree for `0.12.0`: <https://github.com/mozilla/webextension-polyfill/tree/0.12.0>
- Release page for `0.12.0`: <https://github.com/mozilla/webextension-polyfill/releases/tag/0.12.0>

Inference from the vendored file header: the bundled file in this repo is
`webextension-polyfill v0.12.0`.
