// Chrome MV3 service-worker loader. Chrome-only: Firefox loads these three
// files via the manifest background.scripts array instead (importScripts is
// undefined in Firefox's event-page background).
importScripts("browser-polyfill.min.js", "search.js", "background.js");
