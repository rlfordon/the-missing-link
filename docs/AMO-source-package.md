# AMO source package README

This source package corresponds to `The Missing Link` version `0.6.0`.

## Build / packaging model

There is no app build step, bundler, transpiler, or package-manager-driven
build for the extension's own code.

- `manifest.json` loads the extension files directly.
- `background.js`, `search.js`, `content.js`, `popup.js`, and `options.js` are
  plain JavaScript source files.
- `sw.js` is a tiny service-worker loader used for Chrome compatibility.

## Third-party library

This version vendors one minified third-party library:

- `browser-polyfill.min.js`
  - identified in the vendored file header as `webextension-polyfill v0.12.0`
  - project: <https://github.com/mozilla/webextension-polyfill>
  - tagged source tree: <https://github.com/mozilla/webextension-polyfill/tree/0.12.0>
  - release page: <https://github.com/mozilla/webextension-polyfill/releases/tag/0.12.0>

## Relationship to the upload ZIP

The browser-store upload ZIP is a minimal runtime package. This source package
includes the same runtime files plus reviewer-facing documentation. The runtime
ZIP intentionally omits:

- `.git/`
- `.github/`
- `.claude/`
- `dist/`
- `build/`
- `tests/`
- local agent / assistant notes such as `AGENTS.md` and `CLAUDE.md`

## Reproducing the upload ZIPs

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-submission.ps1
```

That script recreates the Chrome upload ZIP, the Firefox upload ZIP, and this
source ZIP from the tracked workspace files.
