// ─────────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────────
let i18nStrings = {};
const LANG_URL  = lang => chrome.runtime.getURL(`lang/${lang}.json`);

async function loadLang(lang) {
  try {
    const res = await fetch(LANG_URL(lang));
    if (res.ok) {
      i18nStrings = await res.json();
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`Failed to load language ${lang}:`, err);
    if (lang !== "en") {
      try {
        const fallbackRes = await fetch(LANG_URL("en"));
        if (fallbackRes.ok) {
          i18nStrings = await fallbackRes.json();
        }
      } catch (fallbackErr) {
        console.error("Failed to load fallback language");
        i18nStrings = {};
      }
    } else {
      i18nStrings = {};
    }
  }

  applyI18n();
  applyTargetOptions();
}

function t(key, fallback) {
  const translation = i18nStrings[key];
  if (translation === undefined || translation === "") {
    return fallback || key;
  }
  return translation;
}

function applyI18n() {
  document.documentElement.dir = ["ar", "he"].includes(currentSettings.lang) ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const translation = t(key);
    el.textContent = translation;
  });
  
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.dataset.i18nHtml;
    const translation = t(key);
    if (translation !== key && translation !== "") {
      el.innerHTML = translation;
    }
  });
  
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const translation = t(key);
    if (translation !== key && translation !== "") {
      el.placeholder = translation;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings (theme + lang)
// ─────────────────────────────────────────────────────────────────────────────
let currentSettings = { theme: "light", lang: "en" };

function getSettings() {
  return new Promise(res =>
    chrome.storage.local.get(["settings"], d => res(d.settings || { theme: "light", lang: "en" }))
  );
}
function saveSettings(s) {
  return new Promise(res => chrome.storage.local.set({ settings: s }, res));
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelectorAll(".seg-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.themeVal === theme)
  );
}

document.querySelectorAll(".seg-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const theme = btn.dataset.themeVal;
    applyTheme(theme);
    currentSettings.theme = theme;
    await saveSettings(currentSettings);
    showToast(t("toast_settings_saved", "Settings saved"), "success");
  });
});

const langSelect = document.getElementById("langSelect");
langSelect.addEventListener("change", async () => {
  currentSettings.lang = langSelect.value;
  await saveSettings(currentSettings);
  await loadLang(currentSettings.lang);
  loadEngines();
  showToast(t("toast_settings_saved", "Settings saved"), "success");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────
const toast = document.getElementById("toast");
let toastTimer;
function showToast(msg, type = "") {
  toast.textContent = msg;
  toast.className   = "toast show" + (type ? " " + type : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = "toast"; }, 2400);
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage helpers
// ─────────────────────────────────────────────────────────────────────────────
function getEngines() {
  return new Promise(res => chrome.storage.local.get(["engines"], d => res(d.engines || [])));
}
function setEngines(engines) {
  return new Promise(res => chrome.storage.local.set({ engines }, res));
}

// ─────────────────────────────────────────────────────────────────────────────
// Logo resolution
// ─────────────────────────────────────────────────────────────────────────────
let _libraryForLogo = null;

async function resolveLogoForUrl(url) {
  if (!_libraryForLogo) {
    try {
      const res  = await fetch(chrome.runtime.getURL("library.json"));
      _libraryForLogo = res.ok ? await res.json() : [];
    } catch { _libraryForLogo = []; }
  }
  try {
    const parsed   = new URL(url.includes("://") ? url : "https://" + url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    for (const entry of _libraryForLogo) {
      try {
        const eHost = new URL(entry.url).hostname.replace(/^www\./, "");
        if (eHost === hostname && entry.logo) return entry.logo;
      } catch {}
    }
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return "engines/default.webp";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function targetLabel(v) {
  return v === "same_tab" ? t("target_same_tab", "Same Tab")
       :                    t("target_new_tab",   "New Tab");
}
function targetIcon(v) {
  return v === "same_tab" ? "↩" : "🗗";
}

function applyTargetOptions() {
  document.querySelectorAll(".field-select[id$='TargetSelect'], #targetSelect").forEach(sel => {
    sel.querySelectorAll("option").forEach(opt => {
      const key = opt.value === "new_tab" ? "target_new_tab" : "target_same_tab";
      const translated = t(key);
      const icon = opt.value === "new_tab" ? "🗗 " : "↩ ";
      if (translated !== key) {
        opt.textContent = icon + translated;
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shortcut code helpers (NEW)
// ─────────────────────────────────────────────────────────────────────────────
function codeToShortcutPart(code) {
  if (code.startsWith('Key')) return code;
  if (code.startsWith('Digit')) return code;
  return code;
}

function shortcutPartToDisplay(part) {
  if (part.startsWith('Key')) return part.slice(3);
  if (part.startsWith('Digit')) return part.slice(5);
  const map = {
    'Space': '␣',
    'Enter': '↵',
    'Escape': 'Esc',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→'
  };
  return map[part] || part;
}

function parseShortcut(saved) {
  if (!saved) return null;
  const parts = saved.split('+');
  const modifiers = [];
  let codePart = '';
  for (const p of parts) {
    if (['Ctrl','Alt','Shift','Meta'].includes(p)) {
      modifiers.push(p);
    } else {
      codePart = p;
    }
  }
  return { modifiers, codePart };
}

function formatShortcutForDisplay(saved) {
  const parsed = parseShortcut(saved);
  if (!parsed) return '';
  const displayKey = shortcutPartToDisplay(parsed.codePart);
  return [...parsed.modifiers, displayKey].join('+');
}

function isValidShortcut(saved) {
  if (!saved) return true;
  const parts = saved.split('+');
  const hasModifier = parts.some(p => ['Ctrl','Alt','Shift','Meta'].includes(p));
  return hasModifier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Render engine list with SortableJS
// ─────────────────────────────────────────────────────────────────────────────
const engineList = document.getElementById("engineList");
let sortableInstance = null;

async function loadEngines() {
  const engines = await getEngines();
  engineList.innerHTML = "";

  if (!engines.length) {
    engineList.innerHTML = `<div class="empty-state">
      <i class="bi bi-search"></i>
      ${t("empty_state", "No engines yet. Add one!")}
    </div>`;
    if (sortableInstance) sortableInstance.destroy();
    sortableInstance = null;
    return;
  }

  engines.forEach((engine, index) => {
    const div = document.createElement("div");

    if (engine.separator) {
      div.className   = "engine-item is-separator";
      div.setAttribute("data-id", index);
      div.innerHTML   = `
        <span class="drag-handle"><i class="bi bi-grip-vertical"></i></span>
        <span class="separator-label">─── ${t("separator_label", "separator")} ───</span>
        <div class="engine-actions">
          <button class="icon-btn del" data-index="${index}" title="${t("remove","Remove")}"><i class="bi bi-trash3"></i></button>
        </div>`;
      div.querySelector(".del").addEventListener("click", e => {
        e.stopPropagation();
        removeEngine(parseInt(e.currentTarget.dataset.index));
      });
      engineList.appendChild(div);
      return;
    }

    const isGroup    = Array.isArray(engine.urls) && engine.urls.length > 1;
    const isDisabled = !!engine.disabled;
    div.className = "engine-item" + (isGroup ? " is-group" : "") + (isDisabled ? " is-disabled" : "");
    div.setAttribute("data-id", index);

    const logoHtml = isGroup
      ? `<span style="font-size:17px;flex-shrink:0;"><i class="bi bi-folder"></i></span>`
      : `<img class="engine-logo" src="${escHtml(engine.logo || "engines/default.webp")}" alt="" onerror="this.src='engines/default.webp'">`;

    const primaryUrl = isGroup ? engine.urls[0] : (engine.url || "");
    const displayUrl = primaryUrl.includes("%s") ? primaryUrl : primaryUrl + "%s";

    let badges = "";
    if (isDisabled) {
      badges += `<span class="engine-badge badge-disabled"><i class="bi bi-slash-circle"></i> ${t("badge_disabled", "Disabled")}</span>`;
    }
    if (isGroup) {
      badges += `<span class="engine-badge badge-group"><i class="bi bi-files"></i> ${engine.urls.length} URLs</span>`;
    }
    if (engine.target && engine.target !== "new_tab") {
      badges += `<span class="engine-badge badge-target">${targetIcon(engine.target)} ${targetLabel(engine.target)}</span>`;
    }
    if (engine.shortcut) {
      const displayShortcut = formatShortcutForDisplay(engine.shortcut);
      badges += `<span class="engine-badge badge-shortcut"><i class="bi bi-keyboard"></i> ${escHtml(displayShortcut)}</span>`;
    }

    const toggleTitle    = isDisabled ? t("enable", "Enable") : t("disable", "Disable");
    const toggleIcon     = isDisabled ? "bi-toggle-off" : "bi-toggle-on";
    const toggleStateCls = isDisabled ? "is-off" : "is-on";
    const editTitle      = t("edit", "Edit");
    const removeTitle    = t("remove", "Remove");

    div.innerHTML = `
      <span class="drag-handle"><i class="bi bi-grip-vertical"></i></span>
      ${logoHtml}
      <div class="engine-info">
        <div class="engine-name">${escHtml(engine.name)}</div>
        <div class="engine-meta">
          <span class="engine-url">${escHtml(displayUrl)}</span>
          ${badges}
        </div>
      </div>
      <div class="engine-actions">
        <button class="icon-btn toggle ${toggleStateCls}" data-index="${index}" title="${toggleTitle}"><i class="bi ${toggleIcon}"></i></button>
        <button class="icon-btn edit" data-index="${index}" title="${editTitle}"><i class="bi bi-pencil"></i></button>
        <button class="icon-btn del" data-index="${index}" title="${removeTitle}"><i class="bi bi-trash3"></i></button>
      </div>`;

    div.querySelector(".toggle").addEventListener("click", async e => {
      e.stopPropagation();
      const idx     = parseInt(e.currentTarget.dataset.index);
      const engines = await getEngines();
      engines[idx].disabled = !engines[idx].disabled;
      await setEngines(engines);
      await loadEngines();
      const engineName = engines[idx].name;
      const isNowDisabled = engines[idx].disabled;
      showToast(engineName + " " + (isNowDisabled ? t("toast_disabled","disabled") : t("toast_enabled","enabled")), isNowDisabled ? "" : "success");
    });

    div.querySelector(".edit").addEventListener("click", e => {
      e.stopPropagation();
      openEditModal(parseInt(e.currentTarget.dataset.index));
    });
    div.querySelector(".del").addEventListener("click", e => {
      e.stopPropagation();
      removeEngine(parseInt(e.currentTarget.dataset.index));
    });

    engineList.appendChild(div);
  });

  if (sortableInstance) sortableInstance.destroy();
  sortableInstance = new Sortable(engineList, {
    handle: ".drag-handle",
    animation: 200,
    ghostClass: "sortable-ghost",
    dragClass: "sortable-drag",
    onEnd: async function() {
      const newOrder = [];
      document.querySelectorAll(".engine-item").forEach(el => {
        const originalIndex = parseInt(el.getAttribute("data-id"));
        if (!isNaN(originalIndex)) newOrder.push(originalIndex);
      });
      const engines = await getEngines();
      const reordered = newOrder.map(i => engines[i]);
      await setEngines(reordered);
      await loadEngines();
      showToast(t("toast_order_saved", "Order saved"), "success");
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// URL-row builder
// ─────────────────────────────────────────────────────────────────────────────
function makeUrlRow(value, container) {
  const row     = document.createElement("div");
  row.className = "url-row";

  const inp        = document.createElement("input");
  inp.className    = "input";
  inp.type         = "text";
  inp.placeholder  = "https://example.com/search?q=%s";
  inp.setAttribute("data-url-input", "");
  inp.value        = value || "";
  row.appendChild(inp);

  const rm        = document.createElement("button");
  rm.className    = "url-row-remove";
  rm.title        = t("remove_url", "Remove URL");
  rm.innerHTML    = '<i class="bi bi-x-circle"></i>';
  rm.style.display = "none";
  rm.addEventListener("click", () => {
    row.remove();
    syncRemoveBtns(container);
  });
  row.appendChild(rm);

  return row;
}

function syncRemoveBtns(container) {
  const rows = container.querySelectorAll(".url-row");
  rows.forEach(r => {
    const btn = r.querySelector(".url-row-remove");
    if (btn) btn.style.display = rows.length > 1 ? "" : "none";
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shortcut capture helper
// ─────────────────────────────────────────────────────────────────────────────
function attachShortcutCapture(inputEl, clearBtn) {
  inputEl.addEventListener('keydown', e => {
    e.preventDefault();
    e.stopPropagation();

    const modifiers = [];
    if (e.ctrlKey)  modifiers.push('Ctrl');
    if (e.altKey)   modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.metaKey)  modifiers.push('Meta');

    if (['Control','Alt','Shift','Meta'].includes(e.key)) return;

    const codePart = codeToShortcutPart(e.code);
    let displayKey = '';
    if (e.code.startsWith('Key')) {
      displayKey = e.code.slice(3);
    } else if (e.code.startsWith('Digit')) {
      displayKey = e.code.slice(5);
    } else {
      displayKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    }

    const displayCombo = [...modifiers, displayKey].join('+');
    const codeCombo = [...modifiers, codePart].join('+');

    inputEl.value = displayCombo;
    inputEl.dataset.shortcutValue = codeCombo;
    clearBtn.classList.add('visible');
  });

  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    delete inputEl.dataset.shortcutValue;
    clearBtn.classList.remove('visible');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing Engines Modal (group building)
// ─────────────────────────────────────────────────────────────────────────────
const existingEnginesModal = document.getElementById('existingEnginesModal');
const closeExistingEnginesBtn = document.getElementById('closeExistingEnginesBtn');
const cancelExistingEnginesBtn = document.getElementById('cancelExistingEnginesBtn');
const existingEnginesList = document.getElementById('existingEnginesList');
const addSelectedUrlsBtn = document.getElementById('addSelectedUrlsBtn');
let currentUrlRowsContainer = null;

async function openExistingEnginesModal(container) {
  currentUrlRowsContainer = container;
  const engines = await getEngines();
  const validEngines = engines.filter(e => !e.separator);
  
  existingEnginesList.innerHTML = '';
  validEngines.forEach(engine => {
    const urls = (engine.urls && engine.urls.length) ? engine.urls : [engine.url];
    const displayUrl = urls[0].includes('%s') ? urls[0] : urls[0] + '%s';
    const logo = engine.logo || 'engines/default.webp';
    
    const div = document.createElement('div');
    div.className = 'existing-engine-item';
    div.innerHTML = `
      <input type="checkbox" id="chk_${engine.name.replace(/\s/g,'')}" value="${engine.name}" data-urls='${JSON.stringify(urls)}'>
      <label for="chk_${engine.name.replace(/\s/g,'')}">
        <img class="existing-engine-logo" src="${logo}" onerror="this.src='engines/default.webp'">
        <span class="existing-engine-name">${escHtml(engine.name)}</span>
        <span class="existing-engine-url">${escHtml(displayUrl)}</span>
        ${urls.length > 1 ? `<span class="engine-badge badge-group" style="flex-shrink:0;">${urls.length} URLs</span>` : ''}
      </label>
    `;
    existingEnginesList.appendChild(div);
  });
  
  existingEnginesModal.classList.add('open');
}

function closeExistingEnginesModal() {
  existingEnginesModal.classList.remove('open');
  currentUrlRowsContainer = null;
}

function addSelectedUrlsToContainer() {
  if (!currentUrlRowsContainer) return;
  
  const checkboxes = existingEnginesList.querySelectorAll('input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    showToast('Select at least one engine', 'error');
    return;
  }
  
  checkboxes.forEach(cb => {
    const urls = JSON.parse(cb.dataset.urls);
    urls.forEach(url => {
      const row = makeUrlRow(url, currentUrlRowsContainer);
      currentUrlRowsContainer.appendChild(row);
    });
  });
  
  syncRemoveBtns(currentUrlRowsContainer);
  closeExistingEnginesModal();
  showToast(`Added URLs from ${checkboxes.length} engine(s)`, 'success');
}

// Event listeners for existing engines modal
document.getElementById('addFromExistingBtn').addEventListener('click', () => {
  openExistingEnginesModal(urlRows);
});

document.getElementById('editAddFromExistingBtn').addEventListener('click', () => {
  openExistingEnginesModal(editUrlRows);
});

closeExistingEnginesBtn.addEventListener('click', closeExistingEnginesModal);
cancelExistingEnginesBtn.addEventListener('click', closeExistingEnginesModal);
addSelectedUrlsBtn.addEventListener('click', addSelectedUrlsToContainer);
existingEnginesModal.addEventListener('click', (e) => {
  if (e.target === existingEnginesModal) closeExistingEnginesModal();
});

// ─────────────────────────────────────────────────────────────────────────────
// Add Engine tab
// ─────────────────────────────────────────────────────────────────────────────
const nameInput     = document.getElementById("nameInput");
const urlRows       = document.getElementById("urlRows");
const addUrlRowBtn  = document.getElementById("addUrlRowBtn");
const targetSelect  = document.getElementById("targetSelect");
const shortcutInput = document.getElementById("shortcutInput");
const shortcutClear = document.getElementById("shortcutClear");
const addEngineBtn  = document.getElementById("addEngineBtn");
const addSepBtn     = document.getElementById("addSepBtn");

shortcutClear.classList.remove("visible");
attachShortcutCapture(shortcutInput, shortcutClear);

addUrlRowBtn.addEventListener("click", () => {
  const row = makeUrlRow("", urlRows);
  urlRows.appendChild(row);
  syncRemoveBtns(urlRows);
  row.querySelector("input").focus();
});

async function addEngine() {
  const name = nameInput.value.trim();
  const urls = [...urlRows.querySelectorAll("[data-url-input]")]
    .map(el => el.value.trim()).filter(Boolean);

  if (!name) { showToast(t("toast_fill_fields","Please fill all fields"), "error"); return; }
  if (!urls.length) { showToast(t("toast_fill_fields","Please fill all fields"), "error"); return; }

  const missingPlaceholder = urls.find(u => !u.includes("%s"));
  if (missingPlaceholder) {
    showToast(t("toast_missing_placeholder", "Add %s to URL where search text goes"), "error");
    return;
  }

  const target   = targetSelect.value;
  const shortcut = shortcutInput.dataset.shortcutValue || shortcutInput.value.trim() || null;

  if (shortcut && !isValidShortcut(shortcut)) {
    showToast(t("shortcut_no_modifier", "Shortcut must include at least one modifier (Ctrl, Alt, Shift, Meta)"), "error");
    return;
  }

  const isGroup  = urls.length > 1;
  const engines  = await getEngines();

  if (shortcut) {
    const conflict = engines.find(e => e.shortcut === shortcut);
    if (conflict) {
      showToast(`${t("shortcut_conflict","Shortcut used by")} "${conflict.name}"`, "error");
      return;
    }
  }

  const logo = isGroup ? null : await resolveLogoForUrl(urls[0]);
  engines.push({ name, urls, url: urls[0], logo, target, shortcut });
  await setEngines(engines);

  nameInput.value        = "";
  urlRows.innerHTML      = "";
  const firstRow         = makeUrlRow("", urlRows);
  urlRows.appendChild(firstRow);
  syncRemoveBtns(urlRows);
  targetSelect.value     = "new_tab";
  shortcutInput.value    = "";
  delete shortcutInput.dataset.shortcutValue;
  shortcutClear.classList.remove("visible");

  await loadEngines();
  showToast(`${name} ${t("toast_engine_added","added")}`, "success");
}

async function removeEngine(index) {
  const engines = await getEngines();
  engines.splice(index, 1);
  await setEngines(engines);
  await loadEngines();
}

async function addSeparator() {
  const engines = await getEngines();
  engines.push({ separator: true });
  await setEngines(engines);
  await loadEngines();
  showToast(t("toast_separator_added","Separator added"), "success");
}

addEngineBtn.addEventListener("click", addEngine);
addSepBtn.addEventListener("click", addSeparator);

// ─────────────────────────────────────────────────────────────────────────────
// Edit Modal
// ─────────────────────────────────────────────────────────────────────────────
const editModal         = document.getElementById("editModal");
const closeEditBtn      = document.getElementById("closeEditBtn");
const cancelEditBtn     = document.getElementById("cancelEditBtn");
const saveEditBtn       = document.getElementById("saveEditBtn");
const editNameInput     = document.getElementById("editNameInput");
const editUrlRows       = document.getElementById("editUrlRows");
const editAddUrlRowBtn  = document.getElementById("editAddUrlRowBtn");
const editTargetSelect  = document.getElementById("editTargetSelect");
const editShortcutInput = document.getElementById("editShortcutInput");
const editShortcutClear = document.getElementById("editShortcutClear");

editShortcutClear.classList.remove("visible");
attachShortcutCapture(editShortcutInput, editShortcutClear);

editAddUrlRowBtn.addEventListener("click", () => {
  const row = makeUrlRow("", editUrlRows);
  editUrlRows.appendChild(row);
  syncRemoveBtns(editUrlRows);
  row.querySelector("input").focus();
});

let editingIndex = null;

async function openEditModal(index) {
  const engines = await getEngines();
  const engine  = engines[index];
  if (!engine || engine.separator) return;

  editingIndex = index;
  editNameInput.value = engine.name || "";

  editUrlRows.innerHTML = "";
  const urls = (engine.urls && engine.urls.length) ? engine.urls : [engine.url || ""];
  urls.forEach(u => {
    editUrlRows.appendChild(makeUrlRow(u, editUrlRows));
  });
  syncRemoveBtns(editUrlRows);

  editTargetSelect.value     = engine.target   || "new_tab";
  editShortcutInput.value    = engine.shortcut ? formatShortcutForDisplay(engine.shortcut) : "";
  editShortcutInput.dataset.shortcutValue = engine.shortcut || "";
  editShortcutClear.classList.toggle("visible", !!engine.shortcut);

  editModal.classList.add("open");
  editNameInput.focus();
}

function closeEditModal() {
  editModal.classList.remove("open");
  editingIndex = null;
}

closeEditBtn.addEventListener("click", closeEditModal);
cancelEditBtn.addEventListener("click", closeEditModal);
editModal.addEventListener("click", e => { if (e.target === editModal) closeEditModal(); });

saveEditBtn.addEventListener("click", async () => {
  if (editingIndex === null) return;

  const name = editNameInput.value.trim();
  const urls = [...editUrlRows.querySelectorAll("[data-url-input]")]
    .map(el => el.value.trim()).filter(Boolean);

  if (!name) { showToast(t("toast_fill_fields","Please fill all fields"), "error"); return; }
  if (!urls.length) { showToast(t("toast_fill_fields","Please fill all fields"), "error"); return; }

  const missingPlaceholder = urls.find(u => !u.includes("%s"));
  if (missingPlaceholder) {
    showToast(t("toast_missing_placeholder", "Add %s to URL where search text goes"), "error");
    return;
  }

  const target   = editTargetSelect.value;
  const shortcut = editShortcutInput.dataset.shortcutValue || editShortcutInput.value.trim() || null;

  if (shortcut && !isValidShortcut(shortcut)) {
    showToast(t("shortcut_no_modifier", "Shortcut must include at least one modifier (Ctrl, Alt, Shift, Meta)"), "error");
    return;
  }

  const isGroup  = urls.length > 1;
  const engines  = await getEngines();

  if (shortcut) {
    const conflict = engines.find((e, i) => i !== editingIndex && e.shortcut === shortcut);
    if (conflict) {
      showToast(`${t("shortcut_conflict","Shortcut used by")} "${conflict.name}"`, "error");
      return;
    }
  }

  const existing = engines[editingIndex];
  let logo = existing.logo;
  if (!isGroup) {
    const prevUrl = existing.url || (existing.urls && existing.urls[0]) || "";
    if (urls[0] !== prevUrl) logo = await resolveLogoForUrl(urls[0]);
  } else {
    logo = null;
  }

  engines[editingIndex] = { ...existing, name, urls, url: urls[0], logo, target, shortcut };
  await setEngines(engines);
  closeEditModal();
  await loadEngines();
  showToast(`${name} ${t("toast_updated","updated")}`, "success");
});

// ─────────────────────────────────────────────────────────────────────────────
// Library Modal
// ─────────────────────────────────────────────────────────────────────────────
const LIBRARY_URL     = chrome.runtime.getURL("library.json");
const openLibraryBtn  = document.getElementById("openLibraryBtn");
const closeLibraryBtn = document.getElementById("closeLibraryBtn");
const libraryModal    = document.getElementById("libraryModal");
const librarySearch   = document.getElementById("librarySearch");
const libraryGrid     = document.getElementById("libraryGrid");

let libraryData = [];
let addedNames  = new Set();

openLibraryBtn.addEventListener("click",  openLibrary);
closeLibraryBtn.addEventListener("click", () => libraryModal.classList.remove("open"));
librarySearch.addEventListener("input",   renderLibraryGrid);

async function openLibrary() {
  libraryModal.classList.add("open");
  const engines = await getEngines();
  addedNames = new Set(engines.filter(e => !e.separator).map(e => e.name));
  if (!libraryData.length) await fetchLibrary();
  else renderLibraryGrid();
}

async function fetchLibrary() {
  libraryGrid.innerHTML = `<div class="library-loading" style="grid-column:1/-1">
    <div class="spinner"></div>${t("library_loading","Loading library…")}
  </div>`;
  try {
    const res = await fetch(LIBRARY_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    libraryData     = await res.json();
    _libraryForLogo = libraryData;
    renderLibraryGrid();
  } catch (err) {
    libraryGrid.innerHTML = `<div class="library-error" style="grid-column:1/-1">
      ⚠ ${t("library_error","Could not load library.")}<br><small>${err.message}</small>
    </div>`;
  }
}

function renderLibraryGrid() {
  const q        = librarySearch.value.trim().toLowerCase();
  const filtered = libraryData.filter(e => e.name.toLowerCase().includes(q));
  if (!filtered.length) {
    libraryGrid.innerHTML = `<div class="library-error" style="grid-column:1/-1">
      ${t("library_no_results","No results for")} "${escHtml(q)}"
    </div>`;
    return;
  }
  libraryGrid.innerHTML = "";
  filtered.forEach(engine => {
    const isAdded  = addedNames.has(engine.name);
    const card     = document.createElement("div");
    card.className = "lib-card" + (isAdded ? " added" : "");

    const logoHtml = engine.logo
      ? `<img class="lib-logo" src="${escHtml(engine.logo)}" alt="${escHtml(engine.name)}"
           onerror="this.outerHTML='<div class=lib-logo-fallback>${escHtml(engine.name[0])}</div>'">`
      : `<div class="lib-logo-fallback">${escHtml(engine.name[0])}</div>`;

    card.innerHTML = `
      ${logoHtml}
      <div class="lib-name">${escHtml(engine.name)}</div>
      <button class="lib-add-btn ${isAdded ? "added-btn" : ""}">
        ${isAdded ? "✓ " + t("btn_added","Added") : "+ " + t("btn_add","Add")}
      </button>`;

    if (!isAdded) {
      card.querySelector(".lib-add-btn").addEventListener("click", async () => {
        const engines = await getEngines();
        const urlWithPlaceholder = engine.url.includes("%s") ? engine.url : engine.url + "%s";
        engines.push({
          name: engine.name, urls: [urlWithPlaceholder], url: urlWithPlaceholder,
          logo: engine.logo || "engines/default.webp", target: "new_tab", shortcut: null
        });
        await setEngines(engines);
        addedNames.add(engine.name);
        renderLibraryGrid();
        await loadEngines();
        showToast(`${engine.name} ${t("toast_engine_added","added")}`, "success");
      });
    }
    libraryGrid.appendChild(card);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export / Import
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById("exportBtn").addEventListener("click", async () => {
  const engines = await getEngines();
  const blob    = new Blob([JSON.stringify(engines, null, 2)], { type: "application/json" });
  const url     = URL.createObjectURL(blob);
  const a       = Object.assign(document.createElement("a"), { href: url, download: "menusearch-engines.json" });
  a.click();
  URL.revokeObjectURL(url);
  showToast(t("toast_exported","Exported"), "success");
});

document.getElementById("importBtn").addEventListener("click", () =>
  document.getElementById("importFileInput").click()
);
document.getElementById("importFileInput").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error();
      await setEngines(data);
      await loadEngines();
      showToast(data.length + " " + t("toast_imported","engines imported"), "success");
    } catch {
      showToast(t("toast_invalid_json","Invalid JSON file"), "error");
    }
    e.target.value = "";
  };
  reader.readAsText(file);
});

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  currentSettings = await getSettings();

  applyTheme(currentSettings.theme);
  langSelect.value = currentSettings.lang || "en";

  await loadLang(currentSettings.lang || "en");

  urlRows.innerHTML = "";
  urlRows.appendChild(makeUrlRow("", urlRows));
  syncRemoveBtns(urlRows);

  await loadEngines();
});
