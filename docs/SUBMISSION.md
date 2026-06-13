# Store submission guide

This repo now has two separate store paths:

- [CHROME-listing.md](CHROME-listing.md)
  for the first Chrome Web Store submission.
- [FIREFOX-update.md](FIREFOX-update.md)
  for the AMO update to `v0.6.0`.

## Packaging

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-submission.ps1
```

That creates these artifacts in `dist/`:

- `the-missing-link-chrome-webstore-v0.6.0.zip`
- `the-missing-link-firefox-amo-v0.6.0.zip`
- `the-missing-link-firefox-source-v0.6.0.zip`
- `WHAT-TO-UPLOAD.txt`

## What to upload

### Chrome Web Store

- Upload `dist/the-missing-link-chrome-webstore-v0.6.0.zip`
- Use listing copy from [CHROME-listing.md](CHROME-listing.md)
- Privacy policy URL:
  `https://github.com/rlfordon/the-missing-link/blob/main/PRIVACY.md`
- Manual assets still needed:
  - at least one real screenshot
  - one small promotional image

### Firefox AMO update

- Upload `dist/the-missing-link-firefox-amo-v0.6.0.zip`
- Attach reviewer notes from [FIREFOX-update.md](FIREFOX-update.md)
- If AMO requests or allows a source package for the minified vendored
  polyfill, upload `dist/the-missing-link-firefox-source-v0.6.0.zip`
- Listing copy remains in [AMO-listing.md](AMO-listing.md)
