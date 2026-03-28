/*
  TreePad Web (vanilla JS)
  - Hierarchical tree with add/rename/delete/move/indent/outdent
  - Rich text editor using SunEditor (stores HTML per node)
  - Autosave to IndexedDB (with localStorage fallback); JSON import/export; static HTML export
  - Simple search (title+content)
*/

(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  let sun = null; // SunEditor instance

  const STORAGE_KEY = 'treepad-web-db-v1';
  // IndexedDB configuration
  const IDB_NAME = 'outline-noter';
  const IDB_VERSION = 1;
  let idbPromise = null;
  function openIDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const dbx = req.result;
        if (!dbx.objectStoreNames.contains('meta')) dbx.createObjectStore('meta', { keyPath: 'key' });
        if (!dbx.objectStoreNames.contains('assets')) dbx.createObjectStore('assets', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return idbPromise;
  }
  function idbGet(store, key) {
    return openIDB().then(dbx => new Promise((resolve, reject) => {
      const tx = dbx.transaction(store, 'readonly');
      const os = tx.objectStore(store);
      const g = os.get(key);
      g.onsuccess = () => resolve(g.result);
      g.onerror = () => reject(g.error);
    }));
  }
  function idbPut(store, value) {
    return openIDB().then(dbx => new Promise((resolve, reject) => {
      const tx = dbx.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const p = os.put(value);
      p.onsuccess = () => resolve();
      p.onerror = () => reject(p.error);
    }));
  }
  async function requestPersistentStorage() {
    try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}
  }

  // Data model
  function createNode(title = 'New node') {
    return { id: crypto.randomUUID(), title, content: '', children: [], collapsed: false };
  }

  let db = { root: createNode('Root') };
  let selection = db.root.id;
  const AUTOSAVE_DEBOUNCE_MS = 350;
  let saveDebounceTimer = null;
  let saveQueue = Promise.resolve();

  function findNodeById(id, node = db.root, parent = null, index = 0) {
    if (node.id === id) return { node, parent, index };
    for (let i = 0; i < node.children.length; i++) {
      const res = findNodeById(id, node.children[i], node, i);
      if (res) return res;
    }
    return null;
  }

  function getTreeItemById(id) {
    const items = $$('#tree .title[role="treeitem"]');
    return items.find(el => el.dataset.id === id) || null;
  }

  function focusTreeItem(id = selection, opts = {}) {
    const item = getTreeItemById(id);
    if (!item) return;
    try { item.focus(opts); } catch { item.focus(); }
  }

  function getVisibleNodeIds() {
    const ids = [];
    (function walk(node) {
      ids.push(node.id);
      if (!node.collapsed) node.children.forEach(walk);
    })(db.root);
    return ids;
  }

  function renderTree() {
    const container = $('#tree');
    container.innerHTML = '';
    container.setAttribute('role', 'tree');

    function renderNode(node, level = 1) {
      const li = document.createElement('li');
      li.setAttribute('role', 'none');

      const row = document.createElement('div');
      row.className = 'node';
      row.dataset.id = node.id;
      row.setAttribute('role', 'none');

      const hasChildren = node.children.length > 0;
      const isSelected = selection === node.id;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'toggle';
      toggle.disabled = !hasChildren;
      toggle.textContent = hasChildren ? (node.collapsed ? '[+]' : '[-]') : '';
      toggle.setAttribute('aria-label', hasChildren ? (node.collapsed ? `Expand ${node.title || 'node'}` : `Collapse ${node.title || 'node'}`) : 'No children');
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!hasChildren) return;
        node.collapsed = !node.collapsed;
        save({ silent: true });
        renderTree();
        focusTreeItem(node.id);
      });

      const title = document.createElement('div');
      title.id = `treeitem-${node.id}`;
      title.className = 'title' + (isSelected ? ' active' : '');
      title.textContent = node.title || '(untitled)';
      title.title = node.title || '';
      title.dataset.id = node.id;
      title.setAttribute('role', 'treeitem');
      title.setAttribute('tabindex', isSelected ? '0' : '-1');
      title.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      title.setAttribute('aria-level', String(level));
      if (hasChildren) title.setAttribute('aria-expanded', String(!node.collapsed));
      title.addEventListener('click', () => selectNode(node.id, { focusTree: true }));
      title.addEventListener('focus', () => { if (selection !== node.id) selectNode(node.id, { focusTree: true }); });

      // Drag & drop
      title.setAttribute('draggable', 'true');
      title.addEventListener('dragstart', (e) => onDragStart(e, node));
      title.addEventListener('dragover', (e) => onDragOver(e, node, row));
      title.addEventListener('dragleave', () => onDragLeave(row));
      title.addEventListener('drop', (e) => onDrop(e, node, row));

      row.appendChild(toggle);
      row.appendChild(title);
      li.appendChild(row);

      if (!node.collapsed && hasChildren) {
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'group');
        node.children.forEach(child => ul.appendChild(renderNode(child, level + 1)));
        li.appendChild(ul);
      }
      return li;
    }

    const ul = document.createElement('ul');
    ul.setAttribute('role', 'group');
    ul.appendChild(renderNode(db.root));
    container.appendChild(ul);
    const activeId = selection ? `treeitem-${selection}` : '';
    if (activeId) container.setAttribute('aria-activedescendant', activeId);
  }

  function selectNode(id, opts = {}) {
    if (!id) return;
    const changed = selection !== id;
    selection = id;
    if (changed || opts.forceRender) renderTree();
    if (changed || opts.forceEditor) updateEditor();
    if (opts.focusTree) requestAnimationFrame(() => focusTreeItem(id, { preventScroll: true }));
    // No status text needed on selection
  }

  let currentImageBlobUrls = [];
  async function updateEditor() {
    const { node } = findNodeById(selection) || {};
    if (!node) return;
    $('#titleInput').value = node.title;
    // Revoke previously created blob URLs
    currentImageBlobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
    currentImageBlobUrls = [];
    if (sun && sun.setContents) {
      sun.setContents(node.content || '');
      // After SunEditor renders, re-apply data-asset-id attributes if sanitizer stripped them
      try { annotateImagesFromSource(node.content); } catch {}
    } else {
      const editor = $('#editor');
      if (editor) editor.innerHTML = node.content || '';
    }
    await resolveImagesInEditor();
  }

  function addChild() {
    const { node } = findNodeById(selection);
    const child = createNode('New node');
    node.children.push(child);
    node.collapsed = false;
    save();
    selectNode(child.id);
  }

  function addSibling() {
    const found = findNodeById(selection);
    if (!found) return;
    if (!found.parent) { // root sibling not allowed
      return addChild();
    }
    const sib = createNode('New node');
    found.parent.children.splice(found.index + 1, 0, sib);
    save();
    selectNode(sib.id);
  }

  function deleteNode() {
    const found = findNodeById(selection);
    if (!found || !found.parent) { alert('Cannot delete root'); return; }
    if (!confirm(`Delete "${found.node.title}" and its children?`)) return;
    found.parent.children.splice(found.index, 1);
    save();
    selectNode(found.parent.id);
  }

  function moveUp() {
    const f = findNodeById(selection);
    if (!f || !f.parent || f.index === 0) return;
    const arr = f.parent.children;
    [arr[f.index - 1], arr[f.index]] = [arr[f.index], arr[f.index - 1]];
    save(); renderTree();
  }

  function moveDown() {
    const f = findNodeById(selection);
    if (!f || !f.parent) return;
    const arr = f.parent.children;
    if (f.index >= arr.length - 1) return;
    [arr[f.index + 1], arr[f.index]] = [arr[f.index], arr[f.index + 1]];
    save(); renderTree();
  }

  function indent() {
    const f = findNodeById(selection);
    if (!f || !f.parent || f.index === 0) return;
    const arr = f.parent.children;
    const leftSibling = arr[f.index - 1];
    arr.splice(f.index, 1);
    leftSibling.children.push(f.node);
    leftSibling.collapsed = false;
    save(); renderTree();
  }

  function outdent() {
    const f = findNodeById(selection);
    if (!f || !f.parent) return;
    const grand = findNodeById(f.parent.id);
    if (!grand.parent) return; // parent is root; cannot outdent above root level
    // remove from current parent
    f.parent.children.splice(f.index, 1);
    // insert after parent in grandparent children
    const dest = grand.parent.children;
    const insertAt = grand.index + 1;
    dest.splice(insertAt, 0, f.node);
    save(); renderTree();
  }

  // Search: filter by title/content text, collapse non-matching, and track match list.
  const lastSearch = { query: '', ids: [], index: 0 };
  function htmlToSearchText(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').toLowerCase();
  }
  function applySearch(q) {
    const query = q.trim().toLowerCase();
    const matchedIds = [];
    if (!query) { renderTree(); return matchedIds; }

    function mark(node) {
      const inTitle = (node.title || '').toLowerCase().includes(query);
      const inContent = htmlToSearchText(node.content).includes(query);
      const match = inTitle || inContent;
      let childMatch = false;
      for (const c of node.children) {
        if (mark(c)) childMatch = true;
      }
      if (match) matchedIds.push(node.id);
      node.collapsed = !(match || childMatch) && node.children.length > 0;
      return match || childMatch;
    }
    mark(db.root);
    renderTree();
    return matchedIds;
  }

  function sanitizeInlineStyle(styleValue) {
    const src = String(styleValue || '');
    if (!src) return '';
    if (/expression\s*\(|javascript:|vbscript:/i.test(src)) return '';
    return src
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .filter(part => !/url\s*\(\s*['"]?\s*(javascript:|vbscript:|data:text\/html)/i.test(part))
      .join('; ');
  }

  function isSafeLinkUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return false;
    if (/^(javascript:|vbscript:|file:)/i.test(value)) return false;
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(value)) return true;
    return !/^[a-z][a-z0-9+.-]*:/i.test(value);
  }

  function isSafeImageSrc(raw) {
    const value = String(raw || '').trim();
    if (!value) return false;
    if (/^(javascript:|vbscript:|file:)/i.test(value)) return false;
    if (/^data:image\//i.test(value)) return true;
    if (/^(https?:|blob:|\/)/i.test(value)) return true;
    return !/^[a-z][a-z0-9+.-]*:/i.test(value);
  }

  function sanitizeEditorHtml(html) {
    const root = document.createElement('div');
    root.innerHTML = String(html || '');
    root.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(el => el.remove());
    const all = root.querySelectorAll('*');
    for (const el of all) {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = attr.value || '';
        if (name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (name === 'style') {
          const cleanStyle = sanitizeInlineStyle(value);
          if (cleanStyle) el.setAttribute('style', cleanStyle);
          else el.removeAttribute('style');
        }
      }
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') || '';
        if (!isSafeLinkUrl(href)) el.removeAttribute('href');
        const target = el.getAttribute('target');
        if (target === '_blank' && !el.getAttribute('rel')) {
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
      if (el.tagName === 'IMG') {
        const assetId = el.getAttribute('data-asset-id');
        if (assetId) {
          el.removeAttribute('src');
          el.removeAttribute('srcset');
        } else {
          const src = el.getAttribute('src') || '';
          if (!isSafeImageSrc(src)) {
            el.remove();
            continue;
          }
          el.removeAttribute('srcset');
        }
      }
    }
    return root.innerHTML;
  }

  function sanitizeNodeTree(node) {
    if (!node || typeof node !== 'object') return createNode('New node');
    const safeNode = {
      id: (typeof node.id === 'string' && node.id.trim()) ? node.id : crypto.randomUUID(),
      title: typeof node.title === 'string' ? node.title : '',
      content: sanitizeEditorHtml(typeof node.content === 'string' ? node.content : ''),
      children: [],
      collapsed: !!node.collapsed
    };
    const children = Array.isArray(node.children) ? node.children : [];
    safeNode.children = children.map(child => sanitizeNodeTree(child));
    return safeNode;
  }

  function sanitizeDbState(candidateDb) {
    if (!candidateDb?.root) return { root: createNode('Root') };
    return { root: sanitizeNodeTree(candidateDb.root) };
  }

  function normalizeSelection(candidateSelection) {
    if (!candidateSelection) return db.root.id;
    const found = findNodeById(candidateSelection);
    return found?.node?.id || db.root.id;
  }

  function onEditorInput() {
    const f = findNodeById(selection);
    if (!f) return;
    const html = (sun && sun.getContents)
      ? sun.getContents()
      : ($('#editor') ? $('#editor').innerHTML : '');
    f.node.content = sanitizeEditorHtml(html);
    save({ silent: true });
  }

  function onTitleInput(e) {
    const f = findNodeById(selection);
    if (!f) return;
    f.node.title = e.target.value;
    const item = getTreeItemById(selection);
    if (item) {
      item.textContent = f.node.title || '(untitled)';
      item.title = f.node.title || '';
    }
    save({ silent: true });
    if (lastSearch.query.trim()) {
      lastSearch.ids = applySearch(lastSearch.query);
      lastSearch.index = Math.max(0, lastSearch.ids.indexOf(selection));
    }
  }

  // Persistence
  async function persistState(showStatus = false) {
    let fallback = false;
    try {
      await idbPut('meta', { key: 'state', db, selection });
    } catch (e) {
      fallback = true;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ db, selection })); } catch {}
    }
    if (showStatus) status(fallback ? 'Saved (LS fallback)' : 'Saved');
    try { refreshUsage(); } catch {}
  }

  function queuePersist(showStatus = false) {
    saveQueue = saveQueue.then(() => persistState(showStatus)).catch(() => {});
    return saveQueue;
  }

  function flushPendingSave(showStatus = false) {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
      return queuePersist(showStatus);
    }
    return showStatus ? queuePersist(true) : saveQueue;
  }

  function save(opts = {}) {
    const showStatus = !opts.silent;
    const immediate = !!opts.immediate || showStatus;
    if (immediate) {
      if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = null;
      }
      return queuePersist(showStatus);
    }
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null;
      queuePersist(false);
    }, AUTOSAVE_DEBOUNCE_MS);
    return saveQueue;
  }

  async function load() {
    try {
      const state = await idbGet('meta', 'state');
      if (state?.db?.root?.id) {
        db = sanitizeDbState(state.db);
        selection = normalizeSelection(state.selection || state.db.root.id);
        return;
      }
    } catch (e) {
      console.warn('IDB load failed; trying localStorage');
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.db?.root?.id) {
        db = sanitizeDbState(parsed.db);
        selection = normalizeSelection(parsed.selection || db.root.id);
      } else if (parsed?.root?.id) {
        db = sanitizeDbState(parsed);
        selection = normalizeSelection(db.root.id);
      }
    } catch (e) {
      console.warn('Failed to load legacy localStorage DB', e);
    }
  }

  // Import/Export JSON
  function safeFilename(name, fallback = 'outline-noter') {
    const raw = String(name || '').trim();
    const cleaned = raw
      .replace(/[\\\/:*?"<>|]+/g, '_') // remove illegal filename chars
      .replace(/\s+/g, ' ')               // collapse whitespace
      .trim();
    const base = cleaned || fallback;
    return base.slice(0, 120); // keep names reasonable
  }
  function getDefaultJsonFilename() {
    const title = db?.root?.title || '';
    const base = safeFilename(title, 'outline-noter').replace(/\.json$/i, '');
    return base + '.json';
  }
  function getDefaultHtmlFilename() {
    const title = db?.root?.title || '';
    const base = safeFilename(title, 'outline-export').replace(/\.html?$/i, '');
    return base + '.html';
  }
  async function exportJson() {
    // Find referenced asset IDs in content
    const ids = new Set();
    (function walk(n) {
      if (n?.content) {
        const d = document.createElement('div');
        d.innerHTML = n.content;
        d.querySelectorAll('img[data-asset-id]').forEach(img => ids.add(img.getAttribute('data-asset-id')));
      }
      (n.children || []).forEach(walk);
    })(db.root);
    const assetsInline = {};
    for (const id of ids) {
      try {
        const rec = await idbGet('assets', id);
        if (rec?.blob) {
          assetsInline[id] = {
            type: rec.type || rec.blob.type || 'application/octet-stream',
            name: rec.name || '',
            base64: await blobToBase64(rec.blob)
          };
        }
      } catch {}
    }
    const payload = { db, selection, assetsInline };
    downloadText(getDefaultJsonFilename(), JSON.stringify(payload, null, 2));
    try { refreshUsage(); } catch {}
  }
  function importJsonFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        let newDb = null; let newSel = null; let assetsInline = null;
        if (parsed?.db?.root?.id) { newDb = sanitizeDbState(parsed.db); newSel = parsed.selection || parsed.db.root.id; assetsInline = parsed.assetsInline || null; }
        else if (parsed?.root?.id) { newDb = sanitizeDbState(parsed); newSel = parsed.root.id; assetsInline = parsed.assetsInline || null; }
        else throw new Error('Invalid DB');
        (async () => {
          if (assetsInline && typeof assetsInline === 'object') {
            for (const [id, meta] of Object.entries(assetsInline)) {
              try {
                const blob = base64ToBlob(meta.base64, meta.type || 'application/octet-stream');
                await idbPut('assets', { id, blob, type: meta.type || blob.type, name: meta.name || '', size: blob.size, createdAt: Date.now() });
              } catch {}
            }
          }
          db = newDb;
          selection = normalizeSelection(newSel || newDb.root.id);
          save();
          selectNode(selection, { forceRender: true, forceEditor: true });
          try { refreshUsage(); } catch {}
        })();
      } catch (e) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  // Export static HTML with a sidebar TOC and content
  async function exportHtml() {
    // Collect all image asset IDs referenced in content
    const assetIds = new Set();
    (function collectIds(n) {
      if (n?.content) {
        const d = document.createElement('div');
        d.innerHTML = n.content;
        d.querySelectorAll('img[data-asset-id]').forEach(img => {
          const id = img.getAttribute('data-asset-id');
          if (id) assetIds.add(id);
        });
      }
      (n.children || []).forEach(collectIds);
    })(db.root);

    // Build a map id -> data URL for assets
    const idToDataUrl = {};
    for (const id of assetIds) {
      try {
        const rec = await idbGet('assets', id);
        if (rec?.blob) {
          const type = rec.type || rec.blob.type || 'application/octet-stream';
          const b64 = await blobToBase64(rec.blob);
          idToDataUrl[id] = `data:${type};base64,${b64}`;
        }
      } catch {}
    }

    // Helper to inline any referenced assets into provided HTML
    function inlineAssets(html) {
      if (!html) return '';
      const d = document.createElement('div');
      d.innerHTML = sanitizeEditorHtml(html);
      d.querySelectorAll('img[data-asset-id]').forEach(img => {
        const id = img.getAttribute('data-asset-id');
        const dataUrl = idToDataUrl[id];
        if (dataUrl) {
          img.setAttribute('src', dataUrl);
          img.removeAttribute('data-asset-id');
        }
      });
      return d.innerHTML;
    }

    // Try to load KaTeX CSS for offline export of math rendered by SunEditor
    let katexCss = '';
    try {
      const res = await fetch('se/katex/katex.min.css');
      katexCss = await res.text();
      // Font files are not bundled in this project; keep KaTeX layout CSS and use local serif fallbacks.
      katexCss = katexCss.replace(/@font-face\s*{[^}]*}/g, '');
      katexCss += '\n.katex{font-family:"Times New Roman",Georgia,serif!important;}';
    } catch {}

    const parts = [];
    parts.push('<!doctype html><html><head><meta charset="utf-8"><title>TreePad Export</title>');
    parts.push('<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;display:flex;height:100vh}aside{width:300px;border-right:1px solid #ddd;overflow:auto;padding:10px}main{flex:1;overflow:auto;padding:16px}ul{list-style:none;padding-left:16px}a{text-decoration:none;color:#0b5fff}a:hover{text-decoration:underline}h1{font-size:18px}</style>');
    if (katexCss) parts.push('<style>' + katexCss.replace(/<\//g,'<\/') + '</style>');
    parts.push('</head><body>');
    parts.push('<aside><h1>Contents</h1>');
    parts.push('<ul>');
    let idx = 0;
    function walkTOC(node, depth = 0) {
      const id = `n${idx++}`;
      node._exportId = id; // annotate
      parts.push(`<li><a href="#${id}">${escapeHtml(node.title || '(untitled)')}</a></li>`);
      if (node.children?.length) {
        parts.push('<ul>');
        node.children.forEach(ch => walkTOC(ch, depth + 1));
        parts.push('</ul>');
      }
    }
    walkTOC(clone(db.root));
    parts.push('</ul></aside><main>');
    function walkContent(node) {
      parts.push(`<h2 id="${node._exportId}">${escapeHtml(node.title || '(untitled)')}</h2>`);
      const inlined = inlineAssets(node.content || '');
      parts.push(`<div>${inlined}</div>`);
      node.children?.forEach(walkContent);
    }
    const expRoot = clone(db.root);
    // re-run to mirror ids
    idx = 0;
    (function annotate(n){ n._exportId = `n${idx++}`; n.children?.forEach(annotate); })(expRoot);
    walkContent(expRoot);
    parts.push('</main></body></html>');
    downloadText(getDefaultHtmlFilename(), parts.join(''));
  }

  // Utils
  function status(msg) { $('#status').textContent = msg; }
  async function refreshUsage() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) return;
      const est = await navigator.storage.estimate();
      const usage = est.usage || 0;
      const quota = est.quota || 0;
      const pct = quota ? (usage / quota) * 100 : 0;
      const usedMB = usage / 1e6;
      const quotaGB = quota / 1e9;
      const el = document.getElementById('usageMeter');
      if (el) el.textContent = quota ? `${usedMB.toFixed(1)} MB of ${quotaGB.toFixed(1)} GB (${pct.toFixed(2)}%)` : `${usedMB.toFixed(1)} MB`;
    } catch {}
  }
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    try { refreshUsage(); } catch {}
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || '');
        resolve(s.split(',')[1] || '');
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  function base64ToBlob(b64, type = 'application/octet-stream') {
    const bin = atob(b64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type });
  }

  // Drag and drop logic for tree
  let draggingId = null;
  function onDragStart(e, node) {
    draggingId = node.id;
    e.dataTransfer?.setData('text/plain', node.id);
    const el = e.target.closest('.node');
    if (el) el.classList.add('dragging');
  }
  function onDragOver(e, targetNode, rowEl) {
    if (!draggingId || draggingId === targetNode.id) return;
    const drag = findNodeById(draggingId)?.node;
    if (!drag || isDescendant(drag, targetNode)) return; // prevent dropping into own descendant
    e.preventDefault();
    const rect = rowEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pos = y < rect.height * 0.25 ? 'before' : (y > rect.height * 0.75 ? 'after' : 'into');
    rowEl.classList.toggle('drop-before', pos === 'before');
    rowEl.classList.toggle('drop-after', pos === 'after');
    rowEl.classList.toggle('drop-into', pos === 'into');
  }
  function onDragLeave(rowEl) {
    rowEl.classList.remove('drop-before', 'drop-after', 'drop-into', 'dragging');
  }
  function onDrop(e, targetNode, rowEl) {
    e.preventDefault();
    const srcId = draggingId || e.dataTransfer?.getData('text/plain');
    draggingId = null;
    rowEl.classList.remove('drop-before', 'drop-after', 'drop-into');
    const rect = rowEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pos = y < rect.height * 0.25 ? 'before' : (y > rect.height * 0.75 ? 'after' : 'into');
    moveNodeByDnD(String(srcId), targetNode.id, pos);
  }
  function isDescendant(a, b) { // is a ancestor of b?
    if (a.id === b.id) return true;
    for (const c of a.children || []) if (isDescendant(c, b)) return true;
    return false;
  }
  function moveNodeByDnD(srcId, targetId, pos) {
    if (srcId === targetId) return;
    const src = findNodeById(srcId);
    const dst = findNodeById(targetId);
    if (!src || !dst) return;
    // Disallow dropping into own subtree
    if (isDescendant(src.node, dst.node)) return;
    // Remove from old parent
    if (src.parent) src.parent.children.splice(src.index, 1);
    if (pos === 'into') {
      dst.node.children.push(src.node);
      dst.node.collapsed = false;
    } else {
      const arr = dst.parent ? dst.parent.children : null;
      if (!arr) { // target is root; insert at root level
        const rootArr = db.root.children;
        const rootIndex = pos === 'before' ? 0 : rootArr.length;
        rootArr.splice(rootIndex, 0, src.node);
      } else {
        const ins = pos === 'before' ? dst.index : dst.index + 1;
        arr.splice(ins, 0, src.node);
      }
    }
    save();
    selectNode(src.node.id, { forceRender: true });
  }

  function onTreeKeyDown(e) {
    const titleEl = e.target?.closest?.('.title[role="treeitem"]');
    if (!titleEl) return;
    const focusedId = titleEl.dataset.id;
    if (focusedId && focusedId !== selection) selection = focusedId;
    const current = findNodeById(selection);
    if (!current) return;
    const visibleIds = getVisibleNodeIds();
    const idx = Math.max(0, visibleIds.indexOf(selection));
    const selectAndFocus = (id) => {
      if (!id) return;
      selectNode(id, { focusTree: true });
    };

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectAndFocus(visibleIds[idx + 1]);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectAndFocus(visibleIds[idx - 1]);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (current.node.children.length && current.node.collapsed) {
        current.node.collapsed = false;
        save({ silent: true });
        renderTree();
        focusTreeItem(selection);
      } else if (current.node.children.length) {
        selectAndFocus(current.node.children[0].id);
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (current.node.children.length && !current.node.collapsed) {
        current.node.collapsed = true;
        save({ silent: true });
        renderTree();
        focusTreeItem(selection);
      } else if (current.parent) {
        selectAndFocus(current.parent.id);
      }
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      selectAndFocus(visibleIds[0]);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      selectAndFocus(visibleIds[visibleIds.length - 1]);
      return;
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      addChild();
      focusTreeItem(selection);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectAndFocus(selection);
      return;
    }
    if (e.key === 'Delete') {
      e.preventDefault();
      deleteNode();
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      const t = $('#titleInput');
      if (t) { t.focus(); try { t.select(); } catch {} }
      return;
    }
  }

  async function applyKatexFontFallbackIfNeeded() {
    try {
      if (!document.fonts || !document.fonts.check) return;
      await document.fonts.ready;
      const hasKatex = document.fonts.check('12px KaTeX_Main');
      if (!hasKatex) {
        document.body.classList.add('katex-font-fallback');
      }
    } catch {}
  }

  // Wire up UI
  function bindUI() {
    $('#addChild').addEventListener('click', addChild);
    $('#addSibling').addEventListener('click', addSibling);
    $('#deleteNode').addEventListener('click', deleteNode);
    $('#moveUp').addEventListener('click', moveUp);
    $('#moveDown').addEventListener('click', moveDown);
    $('#indent').addEventListener('click', indent);
    $('#outdent').addEventListener('click', outdent);
    $('#titleInput').addEventListener('input', onTitleInput);
    $('#tree').addEventListener('keydown', onTreeKeyDown);

    // Initialize SunEditor instance
    createSunEditor();

    $('#search').addEventListener('input', (e) => {
      const val = e.target.value;
      if (!val.trim()) { lastSearch.query = ''; lastSearch.ids = []; lastSearch.index = 0; renderTree(); return; }
      const ids = applySearch(val);
      lastSearch.query = val; lastSearch.ids = ids; lastSearch.index = 0;
      if (ids.length) selectNode(ids[0]);
    });

    $('#newRoot').addEventListener('click', () => {
      if (!confirm('Start a new empty database? This will replace the current tree in memory.')) return;
      db = { root: createNode('Root') };
      selection = db.root.id;
      save();
      selectNode(selection, { forceRender: true, forceEditor: true });
    });

    $('#exportJson').addEventListener('click', exportJson);
    $('#exportHtml').addEventListener('click', exportHtml);
    $('#importJson').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) importJsonFile(f);
      e.target.value = '';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const inEditor = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.sun-editor'));
      const inTitle = document.activeElement === $('#titleInput');
      const inSearch = document.activeElement === $('#search');
      const inTree = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#tree'));
      if (!inEditor && !inTitle && !inSearch && !inTree) {
        if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); addSibling(); }
        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addChild(); }
        if (e.key === 'F2') {
          e.preventDefault();
          const t = $('#titleInput');
          if (t) { t.focus(); try { t.select(); } catch {} }
        }
        if (e.key === 'Delete') { e.preventDefault(); deleteNode(); }
        if (e.key === 'ArrowUp' && e.altKey) { e.preventDefault(); moveUp(); }
        if (e.key === 'ArrowDown' && e.altKey) { e.preventDefault(); moveDown(); }
        if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); indent(); }
        if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); outdent(); }
      }
      if (inSearch) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const currentVal = $('#search').value;
          if (lastSearch.query !== currentVal) {
            const ids = applySearch(currentVal);
            lastSearch.query = currentVal; lastSearch.ids = ids; lastSearch.index = 0;
          } else if (lastSearch.ids.length) {
            lastSearch.index = (lastSearch.index + 1) % lastSearch.ids.length;
          }
          if (lastSearch.ids.length) selectNode(lastSearch.ids[lastSearch.index]);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          $('#search').value = '';
          lastSearch.query = '';
          lastSearch.ids = [];
          lastSearch.index = 0;
          renderTree();
        }
      }
    });

    window.addEventListener('beforeunload', () => { flushPendingSave(false); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPendingSave(false);
    });
  }

  async function init() {
    await load();
    selection = normalizeSelection(selection);
    bindUI();
    selectNode(selection, { forceRender: true, forceEditor: true });
    try { document.execCommand('enableObjectResizing', false, true); } catch (e) {}
    try { document.execCommand('enableInlineTableEditing', false, true); } catch (e) {}
    requestPersistentStorage();
    await applyKatexFontFallbackIfNeeded();
    status('Loaded');
    refreshUsage();
    setInterval(refreshUsage, 60000);
  }

  document.addEventListener('DOMContentLoaded', init);

  async function resolveImagesInEditor() {
    const root = (sun && sun.context && sun.context.element && sun.context.element.wysiwyg)
      || document.querySelector('.sun-editor .sun-editor-editable')
      || $('#editor');
    if (!root) return;
    const imgs = root.querySelectorAll('img[data-asset-id]');
    for (const img of imgs) {
      const id = img.getAttribute('data-asset-id');
      try {
        const rec = await idbGet('assets', id);
        if (rec?.blob) {
          const url = URL.createObjectURL(rec.blob);
          img.src = url;
          currentImageBlobUrls.push(url);
        }
      } catch {}
    }
  }

  // If SunEditor sanitized away data-asset-id, reattach from the original saved HTML by order
  function annotateImagesFromSource(savedHtml) {
    const root = (sun && sun.context && sun.context.element && sun.context.element.wysiwyg)
      || document.querySelector('.sun-editor .sun-editor-editable');
    if (!root) return;
    const srcDiv = document.createElement('div');
    srcDiv.innerHTML = savedHtml || '';
    const ids = Array.from(srcDiv.querySelectorAll('img[data-asset-id]')).map(img => img.getAttribute('data-asset-id')).filter(Boolean);
    if (!ids.length) return;
    const imgs = Array.from(root.querySelectorAll('img'));
    let k = 0;
    for (const img of imgs) {
      if (img.hasAttribute('data-asset-id')) continue;
      if (k < ids.length) {
        img.setAttribute('data-asset-id', ids[k++]);
      } else {
        break;
      }
    }
  }

  function createSunEditor() {
    const target = document.getElementById('editor');
    if (!target || typeof window.SUNEDITOR === 'undefined') return;
    sun = SUNEDITOR.create(target, {
      height: '100%',
      katex: window.katex,
      placeholder: 'Start typing your note...',
      defaultStyle: 'font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: var(--text);',
      buttonList: [
        ['undo', 'redo', 'print'],
        ['bold', 'italic', 'underline', 'hiliteColor'],
        ['align', 'list', 'formatBlock', 'horizontalRule'],
        ['table', 'math'],
        ['removeFormat', 'codeView']
      ],
      addTagsWhitelist: 'span|div|ul|ol|li|table|thead|tbody|tr|th|td|colgroup|col|caption|hr',
      attributesWhitelist: {
        img: 'data-asset-id|alt|src|style|width|height',
        a: 'href|target|rel|title',
        table: 'style|width|height|border|cellpadding|cellspacing|align',
        td: 'style|rowspan|colspan|width|height|align',
        th: 'style|rowspan|colspan|width|height|align',
        span: 'style|class'
      },
      hooks: {
        // Disable image insertion entirely (toolbar/paste/drag-drop)
        imageUploadBefore: (files, info, core, uploadHandler) => false
      }
    });
    if (sun) {
      sun.onChange = () => onEditorInput();
    }
  }
})();
