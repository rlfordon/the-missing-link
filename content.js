// Runs in the page context. Listens for a message from the popup and
// returns a cleaned-up version of the visible article text, plus the URL
// and <title>. We try to prefer <article> or <main> if present, since
// most news sites wrap the real content there and the rest of the DOM
// is navigation/ads/footer noise that wastes tokens.

function pickRoot() {
  const candidates = [
    document.querySelector("article"),
    document.querySelector('[role="article"]'),
    document.querySelector("main"),
    document.querySelector("#main"),
    document.querySelector("#content"),
  ].filter(Boolean);
  return candidates[0] || document.body;
}

function extractText(root) {
  // Walk text nodes, skipping script/style/nav/aside/footer/form.
  const SKIP = new Set(["SCRIPT", "STYLE", "NAV", "ASIDE", "FOOTER", "FORM", "NOSCRIPT"]);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentElement;
      while (p) {
        if (SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      const t = node.nodeValue.trim();
      if (!t) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const parts = [];
  let n;
  while ((n = walker.nextNode())) parts.push(n.nodeValue.trim());
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function getSelectionText() {
  // Grab the user's current text selection. Returns the empty string if
  // nothing's selected (or if the selection is entirely whitespace).
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return "";
  const raw = sel.toString();
  return raw.replace(/\s+/g, " ").trim();
}

// Cache the most recent non-empty selection. In practice Firefox preserves
// the selection when the browser_action popup opens, but in edge cases
// (iframes, scripts that clear selection on blur, rich-text editors that
// manage their own selection) the live call can miss. Capturing on
// selectionchange gives us a fallback that survives focus churn.
let lastSelection = "";
document.addEventListener("selectionchange", () => {
  const s = getSelectionText();
  // Only update the cache when there's actually a selection — don't let a
  // transient "selection cleared" event wipe the cache before we read it.
  if (s) lastSelection = s;
});
// Also clear the cache when the user clicks anywhere without selecting, so
// a stale cached selection doesn't hijack a later click-only invocation.
document.addEventListener("mousedown", () => {
  // Delay by a tick so a click that BEGINS a selection doesn't clobber
  // the cache before the selection is made.
  setTimeout(() => {
    const s = getSelectionText();
    if (!s) lastSelection = "";
  }, 0);
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "GRAB_PAGE") {
    const root = pickRoot();
    const text = extractText(root);
    // Hard cap to keep the LLM request bounded. 20k chars is plenty for
    // case identification — we don't need the whole article, just enough
    // for party names, court, docket, dates.
    const MAX = 20000;
    const truncated = text.length > MAX ? text.slice(0, MAX) : text;

    // Selection gets its own (smaller) cap. Users rarely highlight more
    // than a paragraph or two; anything longer is probably an accidental
    // triple-click-drag. 4k chars keeps us honest.
    const SEL_MAX = 4000;
    // Prefer live selection; fall back to the most recently cached one if
    // it's been wiped by the popup-open focus shuffle.
    let selection = getSelectionText() || lastSelection;
    const selection_truncated = selection.length > SEL_MAX;
    if (selection_truncated) selection = selection.slice(0, SEL_MAX);

    return Promise.resolve({
      url: location.href,
      title: document.title || "",
      text: truncated,
      truncated: text.length > MAX,
      selection,              // "" if none
      selection_truncated,
    });
  }
});
