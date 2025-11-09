/*
  TreePad Web (vanilla JS)
  - Hierarchical tree with add/rename/delete/move/indent/outdent
  - Rich text editor using contenteditable (stores HTML per node)
  - Autosave to localStorage; JSON import/export; static HTML export
  - Simple search (title+content)
*/

(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

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
  function idbDel(store, key) {
    return openIDB().then(dbx => new Promise((resolve, reject) => {
      const tx = dbx.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const d = os.delete(key);
      d.onsuccess = () => resolve();
      d.onerror = () => reject(d.error);
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

  function findNodeById(id, node = db.root, parent = null, index = 0) {
    if (node.id === id) return { node, parent, index };
    for (let i = 0; i < node.children.length; i++) {
      const res = findNodeById(id, node.children[i], node, i);
      if (res) return res;
    }
    return null;
  }

  function renderTree() {
    const container = $('#tree');
    container.innerHTML = '';

    function renderNode(node) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'node';
      row.dataset.id = node.id;

      const toggle = document.createElement('button');
      toggle.className = 'toggle';
      toggle.textContent = node.children.length ? (node.collapsed ? '▸' : '▾') : '·';
      toggle.disabled = node.children.length === 0;
      // Override toggle text with ASCII to avoid glyph issues
      toggle.textContent = node.children.length ? (node.collapsed ? '[+]' : '[-]') : '';
      toggle.addEventListener('click', () => { node.collapsed = !node.collapsed; save(); renderTree(); });

      const title = document.createElement('div');
      title.className = 'title' + (selection === node.id ? ' active' : '');
      title.textContent = node.title || '(untitled)';
      title.title = node.title;
      title.addEventListener('click', () => selectNode(node.id));

      // Drag & drop
      title.setAttribute('draggable', 'true');
      title.addEventListener('dragstart', (e) => onDragStart(e, node));
      title.addEventListener('dragover', (e) => onDragOver(e, node, row));
      title.addEventListener('dragleave', () => onDragLeave(row));
      title.addEventListener('drop', (e) => onDrop(e, node, row));

      row.appendChild(toggle);
      row.appendChild(title);
      li.appendChild(row);

      if (!node.collapsed && node.children.length) {
        const ul = document.createElement('ul');
        node.children.forEach(child => ul.appendChild(renderNode(child)));
        li.appendChild(ul);
      }
      return li;
    }

    const ul = document.createElement('ul');
    ul.appendChild(renderNode(db.root));
    container.appendChild(ul);
  }

  function selectNode(id) {
    selection = id;
    renderTree();
    updateEditor();
    // No status text needed on selection
  }

  let currentImageBlobUrls = [];
  async function updateEditor() {
    const { node } = findNodeById(selection) || {};
    if (!node) return;
    $('#titleInput').value = node.title;
    const editor = $('#editor');
    const overlay = editor.querySelector('.img-resizer');
    // Revoke previously created blob URLs
    currentImageBlobUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch {} });
    currentImageBlobUrls = [];
    editor.innerHTML = node.content || '';
    if (overlay) editor.appendChild(overlay);
    await resolveImagesInEditor();
  }

  function addChild() {
    const { node } = findNodeById(selection);
    const child = createNode('New node');
    node.children.push(child);
    node.collapsed = false;
    save();
    renderTree();
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
    renderTree();
    selectNode(sib.id);
  }

  function renameNode() {
    const { node } = findNodeById(selection) || {};
    if (!node) return;
    const t = prompt('Rename node', node.title);
    if (t == null) return;
    node.title = t.trim() || 'Untitled';
    save();
    renderTree();
    updateEditor();
  }

  function deleteNode() {
    const found = findNodeById(selection);
    if (!found || !found.parent) { alert('Cannot delete root'); return; }
    if (!confirm(`Delete "${found.node.title}" and its children?`)) return;
    found.parent.children.splice(found.index, 1);
    save();
    renderTree();
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

  // Search (simple): filter by title/content, collapse non-matching, and track match list
  const lastSearch = { query: '', ids: [], index: 0 };
  function applySearch(q) {
    const query = q.trim().toLowerCase();
    const matchedIds = [];
    if (!query) { renderTree(); return matchedIds; }

    function mark(node) {
      const textContent = (node.content || '').toLowerCase();
      const inTitle = (node.title || '').toLowerCase().includes(query);
      const inContent = textContent.includes(query);
      let match = inTitle || inContent;
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

  // Editor commands
  function exec(cmd, value = null) {
    document.execCommand(cmd, false, value);
    onEditorInput();
  }

  function onEditorInput() {
    const f = findNodeById(selection);
    if (!f) return;
    const editor = $('#editor');
    const overlay = editor.querySelector('.img-resizer');
    let removed = false;
    if (overlay && overlay.parentNode === editor) { editor.removeChild(overlay); removed = true; }
    // Sanitize editor HTML: remove transient src on asset images
    const tmp = document.createElement('div');
    tmp.innerHTML = editor.innerHTML;
    tmp.querySelectorAll('img[data-asset-id]').forEach(img => img.removeAttribute('src'));
    f.node.content = tmp.innerHTML;
    if (removed) editor.appendChild(overlay);
    save({ silent: true });
  }

  function onTitleInput(e) {
    const f = findNodeById(selection);
    if (!f) return;
    f.node.title = e.target.value;
    save({ silent: true });
    renderTree();
  }

  // Persistence
function save(opts = {}) {
    (async () => {
      try {
        await idbPut('meta', { key: 'state', db, selection });
        if (!opts.silent) status('Saved');
        try { refreshUsage(); } catch {}
      } catch (e) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ db, selection })); } catch {}
        if (!opts.silent) status('Saved (LS fallback)');
        try { refreshUsage(); } catch {}
      }
    })();
  }
  async function load() {
    try {
      const state = await idbGet('meta', 'state');
      if (state?.db?.root?.id) {
        db = state.db;
        selection = state.selection || state.db.root.id;
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
        db = parsed.db;
        selection = parsed.selection || db.root.id;
      } else if (parsed?.root?.id) {
        db = parsed;
        selection = db.root.id;
      }
    } catch (e) {
      console.warn('Failed to load legacy localStorage DB', e);
    }
  }

  // Import/Export JSON
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
    downloadText('outline-noter.json', JSON.stringify(payload, null, 2));
    try { refreshUsage(); } catch {}
  }
  function importJsonFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        let newDb = null; let newSel = null; let assetsInline = null;
        if (parsed?.db?.root?.id) { newDb = parsed.db; newSel = parsed.selection || parsed.db.root.id; assetsInline = parsed.assetsInline || null; }
        else if (parsed?.root?.id) { newDb = parsed; newSel = parsed.root.id; assetsInline = parsed.assetsInline || null; }
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
          db = newDb; selection = newSel || newDb.root.id;
          save();
          renderTree();
          await updateEditor();
          try { refreshUsage(); } catch {}
        })();
      } catch (e) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  // Export static HTML with a sidebar TOC and content
  function exportHtml() {
    const parts = [];
    parts.push('<!doctype html><html><head><meta charset="utf-8"><title>TreePad Export</title>');
    parts.push('<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;display:flex;height:100vh}aside{width:300px;border-right:1px solid #ddd;overflow:auto;padding:10px}main{flex:1;overflow:auto;padding:16px}ul{list-style:none;padding-left:16px}a{text-decoration:none;color:#0b5fff}a:hover{text-decoration:underline}h1{font-size:18px}</style>');
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
      parts.push(`<div>${node.content || ''}</div>`);
      node.children?.forEach(walkContent);
    }
    const expRoot = clone(db.root);
    // re-run to mirror ids
    idx = 0;
    (function annotate(n){ n._exportId = `n${idx++}`; n.children?.forEach(annotate); })(expRoot);
    walkContent(expRoot);
    parts.push('</main></body></html>');
    downloadText('outline-export.html', parts.join(''));
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
    save(); renderTree(); selectNode(src.node.id);
  }

  // Wire up UI
  function bindUI() {
    $('#addChild').addEventListener('click', addChild);
    $('#addSibling').addEventListener('click', addSibling);
    const rn = $('#renameNode'); if (rn) rn.addEventListener('click', renameNode);
    $('#deleteNode').addEventListener('click', deleteNode);
    $('#moveUp').addEventListener('click', moveUp);
    $('#moveDown').addEventListener('click', moveDown);
    $('#indent').addEventListener('click', indent);
    $('#outdent').addEventListener('click', outdent);

    $('#titleInput').addEventListener('input', onTitleInput);
    const editorEl = $('#editor');
    $('#editor').addEventListener('input', onEditorInput);
    // Paste images
    editorEl.addEventListener('paste', async (e) => {
      const items = e.clipboardData?.items || [];
      const imgs = Array.from(items).filter(it => it.type && it.type.startsWith('image/'));
      if (imgs.length) {
        e.preventDefault();
        for (const it of imgs) {
          const f = it.getAsFile(); if (f) await insertImageFile(f);
        }
      }
    });
    // Drag/drop images
    editorEl.addEventListener('dragover', (e) => {
      const hasImage = Array.from(e.dataTransfer?.items || []).some(it => it.kind === 'file' && it.type.startsWith('image/'));
      if (hasImage) { e.preventDefault(); editorEl.classList.add('dragover'); }
    });
    editorEl.addEventListener('dragleave', () => editorEl.classList.remove('dragover'));
    editorEl.addEventListener('drop', async (e) => {
      const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault(); editorEl.classList.remove('dragover');
        for (const f of files) await insertImageFile(f);
      }
    });
    // Edit formula on double click
    editorEl.addEventListener('dblclick', (e) => {
      const formula = e.target.closest && e.target.closest('.formula');
      if (formula) {
        e.preventDefault();
        const current = formula.getAttribute('data-tex') || '';
        const next = prompt('Edit LaTeX (subset supported):', current);
        if (next != null) replaceFormulaElement(formula, String(next));
      }
    });

    $$('.editor-toolbar button[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => exec(btn.dataset.cmd));
    });
    $('#makeLink').addEventListener('click', () => { const url = prompt('URL'); if (url) exec('createLink', url); });
    $('#insertFormula').addEventListener('click', () => insertFormula());
    $('#attachImage').addEventListener('click', () => $('#imageInput').click());
    $('#clearFormat').addEventListener('click', () => exec('removeFormat'));

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
      selection = db.root.id; save(); renderTree(); updateEditor();
    });

    $('#exportJson').addEventListener('click', exportJson);
    $('#exportHtml').addEventListener('click', exportHtml);
    $('#importJson').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) importJsonFile(f); e.target.value=''; });
    $('#imageInput').addEventListener('change', async (e) => { const files = Array.from(e.target.files || []); for (const f of files) await insertImageFile(f); e.target.value=''; });

    // Normalize any garbled labels to safe text at runtime
    const upBtn = $('#moveUp'); if (upBtn) upBtn.textContent = 'Up';
    const downBtn = $('#moveDown'); if (downBtn) downBtn.textContent = 'Down';
    const indentBtn = $('#indent'); if (indentBtn) indentBtn.textContent = 'Indent';
    const outdentBtn = $('#outdent'); if (outdentBtn) outdentBtn.textContent = 'Outdent';
    const ulBtn = document.querySelector('button[data-cmd="insertUnorderedList"]'); if (ulBtn) ulBtn.textContent = '* List';

    // Ensure placeholder renders with ASCII-only fallback
    const style = document.createElement('style');
    style.textContent = ".editor:empty:before { content: 'Start typing your note...'; color: var(--muted); }";
    document.head.appendChild(style);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const inEditor = document.activeElement === $('#editor') || $('#editor').contains(document.activeElement);
      const inTitle = document.activeElement === $('#titleInput');
      const inSearch = document.activeElement === $('#search');
      if (!inEditor && !inTitle && !inSearch) {
        if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); addSibling(); }
        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addChild(); }
        if (e.key === 'F2') { e.preventDefault(); const t=$('#titleInput'); if (t) { t.focus(); try{ t.select(); }catch{} } }
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
          e.preventDefault(); $('#search').value = ''; lastSearch.query = ''; lastSearch.ids = []; lastSearch.index = 0; renderTree();
        }
      }
      if (inEditor) {
        if (e.key.toLowerCase() === 'b' && e.ctrlKey) { e.preventDefault(); exec('bold'); }
        if (e.key.toLowerCase() === 'i' && e.ctrlKey) { e.preventDefault(); exec('italic'); }
        if (e.key.toLowerCase() === 'u' && e.ctrlKey) { e.preventDefault(); exec('underline'); }
      }
    });
  }

  async function init() {
    await load();
    if (!selection) selection = db.root.id;
    renderTree();
    selectNode(selection);
    bindUI();
    try { document.execCommand('enableObjectResizing', false, true); } catch (e) {}
    try { document.execCommand('enableInlineTableEditing', false, true); } catch (e) {}
    setupImageResizerFallback();
    requestPersistentStorage();
    status('Loaded');
    refreshUsage();
    setInterval(refreshUsage, 60000);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Insert image file at caret
  function insertImageFile(file) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const id = crypto.randomUUID();
          await idbPut('assets', { id, blob: file, type: file.type, name: file.name, size: file.size, createdAt: Date.now() });
          const url = URL.createObjectURL(file);
          const img = document.createElement('img');
          img.setAttribute('data-asset-id', id);
          img.setAttribute('alt', escapeHtml(file.name));
          img.src = url;
          insertNodeAtCaret(img);
          onEditorInput();
          resolve();
        } catch (e) { reject(e); }
      })();
    });
  }

  async function resolveImagesInEditor() {
    const editor = $('#editor');
    const imgs = editor.querySelectorAll('img[data-asset-id]');
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

  // Insert LaTeX formula (subset) as non-editable element preserving source in data-tex
  function insertFormula() {
    const input = prompt('Enter LaTeX (use $$...$$ for display mode):');
    if (input == null) return;
    const tex = String(input).trim();
    if (!tex) return;
    const display = (tex.startsWith('$$') && tex.endsWith('$$'));
    const inner = display ? tex.slice(2, -2) : (tex.startsWith('$') && tex.endsWith('$') ? tex.slice(1, -1) : tex);
    const html = renderLatexSubset(inner);
    const wrapper = document.createElement(display ? 'div' : 'span');
    wrapper.className = 'formula' + (display ? ' block' : '');
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('data-tex', inner);
    wrapper.innerHTML = html;
    insertNodeAtCaret(wrapper);
    onEditorInput();
  }

  function replaceFormulaElement(el, texSource) {
    el.setAttribute('data-tex', texSource);
    el.innerHTML = renderLatexSubset(texSource);
    onEditorInput();
  }

  function insertNodeAtCaret(node) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { $('#editor').appendChild(node); return; }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.setEndAfter(node);
    sel.removeAllRanges(); sel.addRange(range);
  }

  // Minimal offline LaTeX subset renderer
  function renderLatexSubset(src) {
    const s = String(src);
    function esc(t){ return escapeHtml(t); }
    function greek(str){
      const map = {alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',zeta:'ζ',eta:'η',theta:'θ',iota:'ι',kappa:'κ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',upsilon:'υ',phi:'φ',chi:'χ',psi:'ψ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Xi:'Ξ',Pi:'Π',Sigma:'Σ',Upsilon:'Υ',Phi:'Φ',Psi:'Ψ',Omega:'Ω'};
      return str.replace(/\\([A-Za-z]+)/g, (m,n)=> map[n]||m);
    }
    function latexArrows(str){
      return str
        .replace(/\\(to|rightarrow)\b/g, '→')
        .replace(/\\leftarrow\b/g, '←')
        .replace(/\\leftrightarrow\b/g, '↔')
        .replace(/\\Rightarrow\b/g, '⇒')
        .replace(/\\Leftarrow\b/g, '⇐')
        .replace(/\\Leftrightarrow\b/g, '⇔')
        .replace(/\\longrightarrow\b/g, '→')
        .replace(/\\Longrightarrow\b/g, '⇒')
        .replace(/\\longleftarrow\b/g, '←')
        .replace(/\\Longleftarrow\b/g, '⇐')
        .replace(/\\(rightleftharpoons|leftrightharpoons)\b/g, '⇌');
    }
    function textArrows(str){
      return str
        .replace(/&lt;=&gt;/g, '⇌')
        .replace(/&lt;-&gt;/g, '↔')
        .replace(/-&gt;/g, '→')
        .replace(/&lt;-/g, '←');
    }
    function fracOnce(str){
      return str.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_,a,b)=>`<span class="mfrac"><span class="num">${renderLatexSubset(a)}</span><span class="den">${renderLatexSubset(b)}</span></span>`);
    }
    function sqrtOnce(str){
      return str.replace(/\\sqrt\s*\{([^{}]+)\}/g, (_,a)=>`<span class="msqrt">√<span class="radicand">${renderLatexSubset(a)}</span></span>`);
    }
    function superSub(str){
      str = str.replace(/\^\{([^{}]+)\}/g, (_,a)=>`<sup>${renderLatexSubset(a)}</sup>`);
      str = str.replace(/_\{([^{}]+)\}/g, (_,a)=>`<sub>${renderLatexSubset(a)}</sub>`);
      str = str.replace(/\^([A-Za-z0-9])/g, (_,a)=>`<sup>${esc(a)}</sup>`);
      str = str.replace(/_([A-Za-z0-9])/g, (_,a)=>`<sub>${esc(a)}</sub>`);
      return str;
    }
    // Safer mappings using HTML entities via wrapper helpers below
    let out = esc(s);
    out = greekSafe(out);
    out = latexArrowsSafe(out);
    out = textArrowsSafe(out);
    for (let i=0;i<3;i++){ out = fracOnce(out); out = sqrtOnceSafe(out); }
    out = superSub(out);
    return out;
  }

  // Safe helpers (do not depend on platform encoding)
  function greekSafe(str){
    return str.replace(/\\([A-Za-z]+)/g, (m,n)=>({
      alpha:'&alpha;', beta:'&beta;', gamma:'&gamma;', delta:'&delta;', epsilon:'&epsilon;', zeta:'&zeta;', eta:'&eta;', theta:'&theta;', iota:'&iota;', kappa:'&kappa;', lambda:'&lambda;', mu:'&mu;', nu:'&nu;', xi:'&xi;', pi:'&pi;', rho:'&rho;', sigma:'&sigma;', tau:'&tau;', upsilon:'&upsilon;', phi:'&phi;', chi:'&chi;', psi:'&psi;', omega:'&omega;',
      Gamma:'&Gamma;', Delta:'&Delta;', Theta:'&Theta;', Lambda:'&Lambda;', Xi:'&Xi;', Pi:'&Pi;', Sigma:'&Sigma;', Upsilon:'&Upsilon;', Phi:'&Phi;', Psi:'&Psi;', Omega:'&Omega;'
    }[n]||m));
  }
  function latexArrowsSafe(str){
    return str
      .replace(/\\(to|rightarrow)\b/g, '&rarr;')
      .replace(/\\leftarrow\b/g, '&larr;')
      .replace(/\\leftrightarrow\b/g, '&harr;')
      .replace(/\\Rightarrow\b/g, '&rArr;')
      .replace(/\\Leftarrow\b/g, '&lArr;')
      .replace(/\\Leftrightarrow\b/g, '&hArr;')
      .replace(/\\longrightarrow\b/g, '&rarr;')
      .replace(/\\Longrightarrow\b/g, '&rArr;')
      .replace(/\\longleftarrow\b/g, '&larr;')
      .replace(/\\Longleftarrow\b/g, '&lArr;')
      .replace(/\\(rightleftharpoons|leftrightharpoons)\b/g, '&#8652;');
  }
  function textArrowsSafe(str){
    return str
      .replace(/&lt;=&gt;/g, '&#8652;')
      .replace(/&lt;-&gt;/g, '&harr;')
      .replace(/-&gt;/g, '&rarr;')
      .replace(/&lt;-/g, '&larr;');
  }
  function sqrtOnceSafe(str){
    return str.replace(/\\sqrt\s*\{([^{}]+)\}/g, (_,a)=>`<span class="msqrt">&#8730;<span class="radicand">${renderLatexSubset(a)}</span></span>`);
  }

  // Fallback image resizer (for browsers without native handles in contenteditable)
  function setupImageResizerFallback() {
    const editor = $('#editor');
    const overlay = document.createElement('div');
    overlay.className = 'img-resizer hidden';
    const se = document.createElement('div');
    se.className = 'handle se';
    overlay.appendChild(se);
    editor.appendChild(overlay);

    let currentImg = null;
    let dragging = false;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    function updateOverlay() {
      if (!currentImg) { overlay.classList.add('hidden'); return; }
      const imgRect = currentImg.getBoundingClientRect();
      const edRect = editor.getBoundingClientRect();
      const top = imgRect.top - edRect.top + editor.scrollTop;
      const left = imgRect.left - edRect.left + editor.scrollLeft;
      overlay.style.top = `${top}px`;
      overlay.style.left = `${left}px`;
      overlay.style.width = `${imgRect.width}px`;
      overlay.style.height = `${imgRect.height}px`;
      overlay.classList.remove('hidden');
    }

    function pickImageFromSelection(evt) {
      const t = evt?.target;
      if (t && t.tagName === 'IMG') {
        currentImg = t;
        updateOverlay();
        return;
      }
      // If clicking outside any image, hide overlay
      if (!editor.contains(t)) { hideOverlay(); return; }
      if (t && t.closest && t.closest('.img-resizer')) return; // clicks on overlay
      // Not on image: hide
      hideOverlay();
    }

    function hideOverlay() {
      currentImg = null; overlay.classList.add('hidden');
    }

    se.addEventListener('mousedown', (e) => {
      if (!currentImg) return;
      e.preventDefault(); e.stopPropagation();
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      const rect = currentImg.getBoundingClientRect();
      startW = rect.width; startH = rect.height;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onUp, { once: true });
    });

    function onDrag(e) {
      if (!dragging || !currentImg) return;
      const dx = e.clientX - startX;
      const newW = Math.max(20, Math.round(startW + dx));
      currentImg.style.width = `${newW}px`;
      currentImg.style.height = 'auto';
      updateOverlay();
      onEditorInput();
    }
    function onUp() {
      dragging = false;
      document.removeEventListener('mousemove', onDrag);
      updateOverlay();
    }

    // Events
    editor.addEventListener('click', pickImageFromSelection);
    editor.addEventListener('scroll', () => { if (currentImg) updateOverlay(); });
    window.addEventListener('resize', () => { if (currentImg) updateOverlay(); });
    // If an image is inserted via paste/upload, select it and show handles
    editor.addEventListener('input', () => {
      // Heuristic: if last child is an image or selection contains an image
      const sel = document.getSelection();
      if (sel && sel.anchorNode) {
        let el = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
        const img = el?.closest && el.closest('img');
        if (img) { currentImg = img; updateOverlay(); return; }
      }
    });
  }
})();
