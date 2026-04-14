// content.js — injected into every page
// Captures keyboard shortcuts with the real page text selection.

(function () {
  if (window.__menuSearchLoaded) return;
  window.__menuSearchLoaded = true;

  // Use keydown in CAPTURE phase so we intercept before the page.
  document.addEventListener("keydown", function (e) {
    // Ignore bare modifier keys
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
    // Must have at least one modifier
    if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) return;

    // Build combo based on physical key codes (independent of layout)
    const parts = [];
    if (e.ctrlKey)  parts.push("Ctrl");
    if (e.altKey)   parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey)  parts.push("Meta");
    
    const code = e.code;
    let codePart = '';
    if (code.startsWith('Key')) codePart = code;           // KeyA .. KeyZ
    else if (code.startsWith('Digit')) codePart = code;    // Digit0 .. Digit9
    else codePart = code; // Space, Enter, etc.
    
    if (!codePart) return;
    parts.push(codePart);
    const combo = parts.join("+");

    // Read engines synchronously from a cached copy we keep updated
    const engines = window.__menuSearchEngines || [];
    const engine  = engines.find(en => en.shortcut === combo);
    if (!engine) return;

    // We have a match — read the selection NOW (before any async gap)
    const selectionText = window.getSelection().toString().trim();
    if (!selectionText) return;

    // Safe to prevent default now, synchronously
    e.preventDefault();
    e.stopPropagation();

    // Fire and forget — result handled by background.js
    chrome.runtime.sendMessage({
      type: "shortcut_search",
      engine,
      selectionText
    }).catch(() => {});
  }, true);

  // ── Keep a local cache of engines so the keydown handler stays sync ──
  function refreshCache() {
    chrome.storage.local.get(["engines"], data => {
      window.__menuSearchEngines = (data.engines || []).filter(e => e.shortcut);
    });
  }

  refreshCache();

  // Update cache whenever engines change
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.engines) refreshCache();
  });
})();
