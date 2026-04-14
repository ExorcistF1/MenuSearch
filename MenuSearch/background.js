const PARENT_ID = "custom-search-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Default engines on first install
// ─────────────────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["engines"], data => {
    if (!data.engines) {
      chrome.storage.local.set({
        engines: [
          { name: "Google", urls: ["https://www.google.com/search?q=%s"], url: "https://www.google.com/search?q=%s", logo: "/engines/google.webp", target: "new_tab", shortcut: null, disabled: false },
          { name: "Bing",   urls: ["https://www.bing.com/search?q=%s"],   url: "https://www.bing.com/search?q=%s",   logo: "/engines/bing.webp",   target: "new_tab", shortcut: null, disabled: false }
        ]
      });
    }
  });
  refreshMenu();
});

// ─────────────────────────────────────────────────────────────────────────────
// Replace %s placeholder with query text
// ─────────────────────────────────────────────────────────────────────────────
function replacePlaceholder(url, query) {
  return url.replace(/%s/g, query);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rebuild context menu — skips disabled engines
// ─────────────────────────────────────────────────────────────────────────────
function refreshMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: PARENT_ID, title: "Search with", contexts: ["selection"] });

    chrome.storage.local.get(["engines"], data => {
      let sepCount = 0;
      (data.engines || []).forEach((engine, index) => {
        // Skip disabled engines — they should not appear in the context menu
        if (engine.disabled) return;

        if (engine.separator) {
          chrome.contextMenus.create({ id: "sep_" + sepCount++, parentId: PARENT_ID, type: "separator", contexts: ["selection"] });
        } else {
          const isGroup = Array.isArray(engine.urls) && engine.urls.length > 1;
          chrome.contextMenus.create({
            id: "engine_" + index,
            parentId: PARENT_ID,
            title: engine.name,
            contexts: ["selection"]
          });
        }
      });
    });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.engines) refreshMenu();
});

// ─────────────────────────────────────────────────────────────────────────────
// Open URL — handles new_tab, same_tab
// ─────────────────────────────────────────────────────────────────────────────
function openUrl(url, target, sourceTabId, sourceTabIndex) {
  if (target === "same_tab" && sourceTabId != null) {
    chrome.tabs.update(sourceTabId, { url });
  } else {
    const props = { url };
    if (sourceTabIndex != null) props.index = sourceTabIndex + 1;
    chrome.tabs.create(props);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Context menu click
// ─────────────────────────────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!info.selectionText) return;

  chrome.storage.local.get(["engines"], data => {
    const id = info.menuItemId;
    if (!String(id).startsWith("engine_")) return;

    const index  = parseInt(String(id).split("_")[1]);
    const engine = (data.engines || [])[index];
    if (!engine || engine.separator || engine.disabled) return;

    const query    = encodeURIComponent(info.selectionText);
    const target   = engine.target || "new_tab";
    const urls     = (engine.urls && engine.urls.length) ? engine.urls : [engine.url];
    const tabId    = tab ? tab.id : undefined;

    const tabIndex = tab ? tab.index : undefined;
	let nextIndex = (tabIndex != null) ? tabIndex + 1 : undefined;
    urls.forEach((url, i) => {
      const finalUrl = replacePlaceholder(url, query);
      if (i === 0) {
         if (target === "same_tab") {
			 chrome.tabs.update(tabId, { url: finalUrl });
		} else {
			chrome.tabs.create({
				url: finalUrl,
				active: true,
				index: nextIndex
			});
			if (nextIndex !== undefined) nextIndex++;
		}
	} else {
		chrome.tabs.create({
          url: finalUrl,
          active: false,
          index: nextIndex
        });
		if (nextIndex !== undefined) nextIndex++;
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Shortcut message from content.js
// ─────────────────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "shortcut_search" || !msg.engine) return false;

  // Ignore shortcuts for disabled engines
  if (msg.engine.disabled) { sendResponse({ ok: false, reason: "disabled" }); return true; }

  const text = (msg.selectionText || "").trim();
  if (!text) { sendResponse({ ok: false, reason: "no_selection" }); return true; }

  const engine   = msg.engine;
  const query    = encodeURIComponent(text);
  const target   = engine.target || "new_tab";
  const urls     = (engine.urls && engine.urls.length) ? engine.urls : [engine.url];
  const tabId    = sender.tab ? sender.tab.id : undefined;

  const tabIndex = sender.tab ? sender.tab.index : undefined;
  let nextIndex = (tabIndex != null) ? tabIndex + 1 : undefined;
  urls.forEach((url, i) => {
		const finalUrl = replacePlaceholder(url, query);
		if (i === 0) {
			if (target === "same_tab") {
				chrome.tabs.update(tabId, { url: finalUrl });
			} else {
				chrome.tabs.create({
					url: finalUrl,
					active: true,
					index: nextIndex
				});
				if (nextIndex !== undefined) nextIndex++;
			}
		} else {
			chrome.tabs.create({
				url: finalUrl,
				active: false,
				index: nextIndex
			});
			if (nextIndex !== undefined) nextIndex++;
		}
	});

  sendResponse({ ok: true });
  return true;
});

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────
refreshMenu();
