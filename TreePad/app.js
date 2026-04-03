/*
  Outliner Web (vanilla JS)
  - Hierarchical tree with add/rename/delete/move/indent/outdent
  - Rich text editor using SunEditor (stores HTML per node)
  - Autosave to IndexedDB (with localStorage fallback); JSON import/export; static HTML export
  - Simple search (title+content)
*/

(function () {
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  let sun = null; // SunEditor instance

  const STORAGE_KEY = 'outliner-web-db-v1';
  const MAP_NODE_WIDTH = 180;
  const MAP_NODE_MIN_HEIGHT = 56;
  const NODE_TEXT_LINE_HEIGHT = 18;
  const NODE_TEXT_HORIZONTAL_PADDING = 14;
  const NODE_TEXT_VERTICAL_PADDING = 12;
  const MAP_WORKSPACE_MIN_WIDTH = 1600;
  const MAP_WORKSPACE_MIN_HEIGHT = 1000;
  const MAP_WORKSPACE_PADDING = 140;
  const MAP_FIT_PADDING = 56;
  const MAP_ZOOM_MIN = 0.35;
  const MAP_ZOOM_MAX = 2.8;
  const MAP_ZOOM_STEP = 1.18;
  const MAX_UNDO_HISTORY = 120;
  const AUTO_ARRANGE_LEFT = 100;
  const AUTO_ARRANGE_TOP = 100;
  const AUTO_ARRANGE_COLUMN_GAP = 250;
  const AUTO_ARRANGE_SIBLING_GAP = 34;
  const NOTES_PANEL_DEFAULT_HEIGHT = 320;
  const NOTES_PANEL_MIN_HEIGHT = 220;
  const NOTES_PANEL_MIN_MAP_HEIGHT = 220;
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
  function createNode(title = 'New node', opts = {}) {
    const x = Number.isFinite(opts.x) ? Math.round(opts.x) : 0;
    const y = Number.isFinite(opts.y) ? Math.round(opts.y) : 0;
    return { id: crypto.randomUUID(), title, content: '', children: [], collapsed: false, x, y };
  }

  let db = { root: createNode('Root', { x: 120, y: 120 }), links: [] };
  let selection = db.root.id;
  let selectedRelationLinkId = null;
  let diagramEnabled = true;
  let mapDrag = null;
  let mapPan = null;
  let notesResize = null;
  let notesPanelHeight = NOTES_PANEL_DEFAULT_HEIGHT;
  let mapPointerInside = false;
  let mapPointerClientX = 0;
  let mapPointerClientY = 0;
  let suppressNextMapCanvasClick = false;
  let mapWorkspace = { minX: 0, minY: 0, width: MAP_WORKSPACE_MIN_WIDTH, height: MAP_WORKSPACE_MIN_HEIGHT };
  let mapZoom = 1;
  let nodeRenderMetrics = new Map();
  let textMeasureContext = null;
  let undoHistory = [];
  let currentSnapshot = null;
  let inlineRename = null;
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

  function collectNodeRecords(node = db.root, parent = null, depth = 0, records = []) {
    records.push({ node, parent, depth });
    node.children.forEach((child) => collectNodeRecords(child, node, depth + 1, records));
    return records;
  }

  function collectNodeIds(node = db.root, ids = new Set()) {
    ids.add(node.id);
    node.children.forEach((child) => collectNodeIds(child, ids));
    return ids;
  }

  function collectSubtreeIds(node, ids = new Set()) {
    if (!node) return ids;
    ids.add(node.id);
    node.children.forEach((child) => collectSubtreeIds(child, ids));
    return ids;
  }

  function getNodeById(id) {
    return findNodeById(id)?.node || null;
  }

  function ensureMapFields(targetDb = db) {
    if (!targetDb || !targetDb.root) return;
    if (!Array.isArray(targetDb.links)) targetDb.links = [];
    const records = collectNodeRecords(targetDb.root);
    records.forEach((rec, index) => {
      if (!Number.isFinite(rec.node.x)) rec.node.x = 120 + rec.depth * 260;
      if (!Number.isFinite(rec.node.y)) rec.node.y = 120 + index * 92;
      rec.node.x = Math.round(rec.node.x);
      rec.node.y = Math.round(rec.node.y);
    });
    pruneInvalidLinks(targetDb);
  }

  function pruneInvalidLinks(targetDb = db) {
    if (!targetDb || !targetDb.root) return;
    if (!Array.isArray(targetDb.links)) {
      targetDb.links = [];
      return;
    }
    const ids = collectNodeIds(targetDb.root);
    targetDb.links = targetDb.links
      .filter(link => link && typeof link === 'object')
      .map(link => ({
        id: (typeof link.id === 'string' && link.id.trim()) ? link.id : crypto.randomUUID(),
        fromId: typeof link.fromId === 'string' ? link.fromId : '',
        toId: typeof link.toId === 'string' ? link.toId : ''
      }))
      .filter(link => link.fromId && link.toId && link.fromId !== link.toId && ids.has(link.fromId) && ids.has(link.toId));
  }

  function getNodeBounds(node) {
    const metrics = getNodeRenderMetrics(node);
    return { left: node.x, top: node.y, right: node.x + MAP_NODE_WIDTH, bottom: node.y + metrics.height };
  }

  function clearChildren(element) {
    if (!element) return;
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function getTextMeasureContext() {
    if (textMeasureContext) return textMeasureContext;
    const canvas = document.createElement('canvas');
    textMeasureContext = canvas.getContext('2d');
    if (textMeasureContext) {
      textMeasureContext.font = '500 14px "Segoe UI", Arial, sans-serif';
    }
    return textMeasureContext;
  }

  function measureTextWidth(value) {
    const ctx = getTextMeasureContext();
    if (!ctx) return String(value || '').length * 8;
    return ctx.measureText(String(value || '')).width;
  }

  function breakLongWordToLines(word, maxWidth) {
    const chunks = [];
    let chunk = '';
    Array.from(word).forEach((char) => {
      const next = `${chunk}${char}`;
      if (chunk && measureTextWidth(next) > maxWidth) {
        chunks.push(chunk);
        chunk = char;
        return;
      }
      chunk = next;
    });
    if (chunk) chunks.push(chunk);
    return chunks.length ? chunks : [word];
  }

  function wrapTextToNodeLines(value) {
    const text = String(value || '').trim() || '(untitled)';
    const maxWidth = Math.max(24, MAP_NODE_WIDTH - NODE_TEXT_HORIZONTAL_PADDING * 2);
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return ['(untitled)'];

    const lines = [];
    let currentLine = '';
    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (measureTextWidth(candidate) <= maxWidth) {
        currentLine = candidate;
        return;
      }
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      if (measureTextWidth(word) <= maxWidth) {
        currentLine = word;
        return;
      }
      const splitWordLines = breakLongWordToLines(word, maxWidth);
      if (splitWordLines.length > 1) {
        lines.push(...splitWordLines.slice(0, -1));
        currentLine = splitWordLines[splitWordLines.length - 1];
      } else {
        currentLine = splitWordLines[0];
      }
    });
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : ['(untitled)'];
  }

  function computeNodeRenderMetrics(node) {
    const lines = wrapTextToNodeLines(node?.title || '(untitled)');
    const height = Math.max(
      MAP_NODE_MIN_HEIGHT,
      NODE_TEXT_VERTICAL_PADDING * 2 + lines.length * NODE_TEXT_LINE_HEIGHT
    );
    return { lines, height };
  }

  function getNodeRenderMetrics(node) {
    if (!node) return { lines: ['(untitled)'], height: MAP_NODE_MIN_HEIGHT };
    const existing = nodeRenderMetrics.get(node.id);
    if (existing) return existing;
    const computed = computeNodeRenderMetrics(node);
    nodeRenderMetrics.set(node.id, computed);
    return computed;
  }

  function buildNodeRenderMetrics() {
    nodeRenderMetrics = new Map();
    collectNodeRecords().forEach(({ node }) => {
      nodeRenderMetrics.set(node.id, computeNodeRenderMetrics(node));
    });
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

  function setTreeItemTitle(item, titleText) {
    if (!item) return;
    item.textContent = titleText || '(untitled)';
    item.title = titleText || '';
  }

  function applyNodeTitle(nodeId, nextTitle) {
    const found = findNodeById(nodeId);
    if (!found) return;
    found.node.title = nextTitle;
    const item = getTreeItemById(nodeId);
    setTreeItemTitle(item, nextTitle);
    save({ silent: true });
    if (lastSearch.query.trim()) {
      lastSearch.ids = applySearch(lastSearch.query);
      lastSearch.index = Math.max(0, lastSearch.ids.indexOf(selection));
    }
    renderMap();
    updateNotesHeader();
  }

  function finishInlineRename(opts = {}) {
    if (!inlineRename) return;
    const commit = opts.commit !== false;
    const state = inlineRename;
    inlineRename = null;
    const finalTitle = commit ? state.input.value : state.originalTitle;

    if (state.input) {
      state.input.removeEventListener('keydown', state.onKeyDown);
      state.input.removeEventListener('click', state.onInputClick);
      state.input.removeEventListener('mousedown', state.onInputMouseDown);
    }

    if (state.titleEl && document.contains(state.titleEl)) {
      state.titleEl.classList.remove('editing');
      state.titleEl.setAttribute('draggable', 'true');
      setTreeItemTitle(state.titleEl, finalTitle);
    }

    if (!commit) return;
    const found = findNodeById(state.id);
    if (!found || found.node.title === finalTitle) return;
    applyNodeTitle(state.id, finalTitle);
  }

  function beginInlineRename(nodeId = selection) {
    const targetId = String(nodeId || '');
    if (!targetId) return;
    if (inlineRename?.id === targetId && inlineRename.input && document.contains(inlineRename.input)) {
      inlineRename.input.focus();
      try { inlineRename.input.select(); } catch {}
      return;
    }
    finishInlineRename({ commit: true });
    if (selection !== targetId) selectNode(targetId, { focusTree: true });
    const found = findNodeById(targetId);
    if (!found) return;
    const titleEl = getTreeItemById(targetId);
    if (!titleEl) return;
    const currentTitle = found.node.title || '';
    titleEl.classList.add('editing');
    titleEl.setAttribute('draggable', 'false');
    titleEl.textContent = '';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-title-input';
    input.value = currentTitle;
    input.setAttribute('aria-label', 'Edit node title');
    titleEl.appendChild(input);

    const onKeyDown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        finishInlineRename({ commit: true });
        focusTreeItem(targetId);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finishInlineRename({ commit: false });
        focusTreeItem(targetId);
        return;
      }
      event.stopPropagation();
    };
    const onInputClick = (event) => event.stopPropagation();
    const onInputMouseDown = (event) => event.stopPropagation();

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('click', onInputClick);
    input.addEventListener('mousedown', onInputMouseDown);
    input.addEventListener('blur', () => { finishInlineRename({ commit: true }); }, { once: true });

    inlineRename = { id: targetId, titleEl, input, originalTitle: currentTitle, onKeyDown, onInputClick, onInputMouseDown };
    input.focus();
    try { input.select(); } catch {}
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
      setTreeItemTitle(title, node.title || '');
      title.dataset.id = node.id;
      title.setAttribute('role', 'treeitem');
      title.setAttribute('tabindex', isSelected ? '0' : '-1');
      title.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      title.setAttribute('aria-level', String(level));
      if (hasChildren) title.setAttribute('aria-expanded', String(!node.collapsed));
      title.addEventListener('click', (event) => {
        event.stopPropagation();
        if (selection === node.id && !inlineRename) {
          beginInlineRename(node.id);
          return;
        }
        selectNode(node.id, { focusTree: true });
      });
      title.addEventListener('focus', () => { if (selection !== node.id) selectNode(node.id, { focusTree: true }); });
      title.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (selection !== node.id) selectNode(node.id, { focusTree: true });
        beginInlineRename(node.id);
      });

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
    selectedRelationLinkId = null;
    if (changed || opts.forceRender) renderTree();
    if (changed || opts.forceEditor) updateEditor();
    if (changed || opts.forceRender || opts.forceMap) renderMap();
    updateNotesHeader();
    if (opts.focusTree) requestAnimationFrame(() => focusTreeItem(id, { preventScroll: true }));
    // No status text needed on selection
  }

  let currentImageBlobUrls = [];
  async function updateEditor() {
    const { node } = findNodeById(selection) || {};
    if (!node) return;
    updateNotesHeader();
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

  function suggestChildPosition(parentNode) {
    const siblingCount = parentNode.children.length;
    const yOffset = (siblingCount - Math.max(0, siblingCount - 1) / 2) * 96;
    return {
      x: parentNode.x + 230,
      y: parentNode.y + yOffset
    };
  }

  function suggestSiblingPosition(found) {
    if (!found.parent) {
      return { x: found.node.x + 230, y: found.node.y + 96 };
    }
    return { x: found.node.x, y: found.node.y + 96 };
  }

  function addChild() {
    const { node } = findNodeById(selection);
    const pos = suggestChildPosition(node);
    const child = createNode('New node', pos);
    node.children.push(child);
    node.collapsed = false;
    save();
    selectNode(child.id, { forceMap: true });
  }

  function addSibling() {
    const found = findNodeById(selection);
    if (!found) return;
    if (!found.parent) { // root sibling not allowed
      return addChild();
    }
    const pos = suggestSiblingPosition(found);
    const sib = createNode('New node', pos);
    found.parent.children.splice(found.index + 1, 0, sib);
    save();
    selectNode(sib.id, { forceMap: true });
  }

  function deleteNode() {
    const found = findNodeById(selection);
    if (!found || !found.parent) { alert('Cannot delete root'); return; }
    if (!confirm(`Delete "${found.node.title}" and its children?`)) return;
    const removedIds = collectSubtreeIds(found.node);
    found.parent.children.splice(found.index, 1);
    db.links = (db.links || []).filter(link => !removedIds.has(link.fromId) && !removedIds.has(link.toId));
    save();
    selectNode(found.parent.id, { forceMap: true });
  }

  function moveUp() {
    const f = findNodeById(selection);
    if (!f || !f.parent || f.index === 0) return;
    const arr = f.parent.children;
    [arr[f.index - 1], arr[f.index]] = [arr[f.index], arr[f.index - 1]];
    save(); renderTree(); renderMap();
  }

  function moveDown() {
    const f = findNodeById(selection);
    if (!f || !f.parent) return;
    const arr = f.parent.children;
    if (f.index >= arr.length - 1) return;
    [arr[f.index + 1], arr[f.index]] = [arr[f.index], arr[f.index + 1]];
    save(); renderTree(); renderMap();
  }

  function indent() {
    const f = findNodeById(selection);
    if (!f || !f.parent || f.index === 0) return;
    const arr = f.parent.children;
    const leftSibling = arr[f.index - 1];
    arr.splice(f.index, 1);
    leftSibling.children.push(f.node);
    leftSibling.collapsed = false;
    save(); renderTree(); renderMap();
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
    save(); renderTree(); renderMap();
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
      collapsed: !!node.collapsed,
      x: Number.isFinite(node.x) ? Math.round(node.x) : 0,
      y: Number.isFinite(node.y) ? Math.round(node.y) : 0
    };
    const children = Array.isArray(node.children) ? node.children : [];
    safeNode.children = children.map(child => sanitizeNodeTree(child));
    return safeNode;
  }

  function sanitizeDbState(candidateDb) {
    if (!candidateDb?.root) return { root: createNode('Root', { x: 120, y: 120 }), links: [] };
    const safeDb = {
      root: sanitizeNodeTree(candidateDb.root),
      links: Array.isArray(candidateDb.links) ? candidateDb.links : []
    };
    ensureMapFields(safeDb);
    return safeDb;
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

  // Persistence
  async function persistState(showStatus = false) {
    ensureMapFields();
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
    if (!opts.silent && !opts.skipHistory) recordUndoSnapshotIfChanged();
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
    parts.push('<!doctype html><html><head><meta charset="utf-8"><title>Outliner Export</title>');
    parts.push('<style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;display:flex;height:100vh}aside{width:300px;border-right:1px solid #ddd;overflow:auto;padding:10px}main{flex:1;overflow:auto;padding:16px}ul{list-style:none;padding-left:16px}a{text-decoration:none;color:#0b5fff}a:hover{text-decoration:underline}h1,h2,h3,h4,h5,h6{color:#1b2e6b}h1{font-size:18px}main table{border-collapse:collapse;border:1px solid #b8beca}main th,main td{border:1px solid #b8beca;padding:4px 6px}</style>');
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

  async function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = url;
    });
  }

  function buildWordExportSvgMarkup() {
    const { canvas } = getMapElements();
    if (!canvas) return '';
    buildNodeRenderMetrics();
    updateMapWorkspaceBounds();

    const exportWidth = Math.max(1, Math.round(mapWorkspace.width));
    const exportHeight = Math.max(1, Math.round(mapWorkspace.height));
    const svgNs = 'http://www.w3.org/2000/svg';
    const clone = canvas.cloneNode(true);
    clone.setAttribute('xmlns', svgNs);
    clone.setAttribute('width', String(exportWidth));
    clone.setAttribute('height', String(exportHeight));
    clone.setAttribute('viewBox', `${mapWorkspace.minX} ${mapWorkspace.minY} ${mapWorkspace.width} ${mapWorkspace.height}`);
    clone.removeAttribute('tabindex');
    clone.style.width = `${exportWidth}px`;
    clone.style.height = `${exportHeight}px`;

    const styleElement = document.createElementNS(svgNs, 'style');
    styleElement.textContent = [
      '#parentArrow path{fill:rgba(30,30,36,0.45);}',
      '#linkArrow path{fill:#b86e15;}',
      '.edge-parent{stroke:rgba(30,30,36,0.36);stroke-width:2;fill:none;stroke-linejoin:round;stroke-linecap:round;marker-end:url(#parentArrow);}',
      '.edge-relation{stroke:#cc7a18;stroke-width:2.2;fill:none;stroke-linejoin:round;stroke-linecap:round;marker-end:url(#linkArrow);}',
      '.edge-relation.selected{stroke:#8a4f04;stroke-width:3.1;}',
      '.map-node rect{fill:#ffffff;stroke:rgba(30,30,36,0.34);stroke-width:1.6;rx:12;ry:12;}',
      '.map-node text{fill:#1e1e24;font:500 14px/1.2 "Segoe UI",Arial,sans-serif;text-anchor:middle;}',
      '.map-node.selected rect{stroke:#3a72ff;stroke-width:2.4;}',
      '.map-node.drop-target rect{stroke:#1b8d4f;stroke-width:2.8;fill:#f2fff7;}'
    ].join('');

    const bgRect = document.createElementNS(svgNs, 'rect');
    bgRect.setAttribute('x', String(mapWorkspace.minX));
    bgRect.setAttribute('y', String(mapWorkspace.minY));
    bgRect.setAttribute('width', String(mapWorkspace.width));
    bgRect.setAttribute('height', String(mapWorkspace.height));
    bgRect.setAttribute('fill', '#f8faff');

    clone.insertBefore(styleElement, clone.firstChild);
    styleElement.insertAdjacentElement('afterend', bgRect);
    return new XMLSerializer().serializeToString(clone);
  }

  async function buildWordMapImageDataUrl() {
    const svgMarkup = buildWordExportSvgMarkup();
    if (!svgMarkup) return '';
    const exportWidth = Math.max(1, Math.round(mapWorkspace.width));
    const exportHeight = Math.max(1, Math.round(mapWorkspace.height));

    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const img = await loadImage(svgUrl);
      const c = document.createElement('canvas');

      // Export a sharper PNG than screen resolution, while capping max pixels.
      const targetScale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
      const maxPixels = 20000000;
      const maxScale = Math.max(1, Math.floor(Math.sqrt(maxPixels / (exportWidth * exportHeight))));
      const scale = Math.max(1, Math.min(targetScale, maxScale));

      c.width = exportWidth * scale;
      c.height = exportHeight * scale;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportWidth, exportHeight);
      ctx.drawImage(img, 0, 0, exportWidth, exportHeight);
      return c.toDataURL('image/png');
    } catch {
      try {
        const encoded = encodeURIComponent(svgMarkup);
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
        const img = await loadImage(dataUrl);
        const c = document.createElement('canvas');
        c.width = exportWidth;
        c.height = exportHeight;
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, exportWidth, exportHeight);
        ctx.drawImage(img, 0, 0, exportWidth, exportHeight);
        return c.toDataURL('image/png');
      } catch {
        const b64 = await blobToBase64(svgBlob);
        return `data:image/svg+xml;base64,${b64}`;
      }
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  function buildWordOutlineHtml(node, depth = 1, parts = []) {
    const heading = Math.min(6, Math.max(2, depth + 1));
    parts.push(`<h${heading}>${escapeHtml(node.title || '(untitled)')}</h${heading}>`);
    const body = sanitizeEditorHtml(node.content || '');
    parts.push(body ? `<div>${body}</div>` : '<p><em>No notes.</em></p>');
    node.children.forEach((child) => buildWordOutlineHtml(child, depth + 1, parts));
    return parts;
  }

  async function exportWordDocument() {
    ensureMapFields();
    const imageUrl = await buildWordMapImageDataUrl();
    const relationItems = (db.links || []).map((link) => {
      const fromLabel = getNodeById(link.fromId)?.title || 'Unknown';
      const toLabel = getNodeById(link.toId)?.title || 'Unknown';
      return `<li>${escapeHtml(fromLabel)} -> ${escapeHtml(toLabel)}</li>`;
    }).join('');
    const outlineSections = buildWordOutlineHtml(db.root).join('');
    const html = [
      '<!doctype html><html><head><meta charset="utf-8">',
      '<style>',
      'body{font-family:Segoe UI,Arial,sans-serif;font-size:10pt;line-height:1.45;color:#111;}',
      'p,li,div,table,td,th{font-size:10pt;}',
      'h1,h2,h3,h4,h5,h6{font-size:10pt;font-weight:700;color:#1b2e6b;}',
      'table{border-collapse:collapse;border:1px solid #b8beca;}',
      'th,td{border:1px solid #b8beca;padding:4px 6px;}',
      'h1{margin-bottom:6px;}',
      'h2,h3,h4,h5,h6{margin:16px 0 6px;}',
      '.meta{color:#555;font-size:10pt;margin-bottom:12px;}',
      '.map{margin:14px 0 18px;border:1px solid #ccc;padding:8px;}',
      '.map img{max-width:100%;height:auto;display:block;}',
      '.links{margin:14px 0;}',
      '</style>',
      '</head><body>',
      `<h1>${escapeHtml(db.root.title || 'Outliner Export')}</h1>`,
      `<p class="meta">Generated ${new Date().toLocaleString()}</p>`,
      imageUrl ? `<div class="map"><img src="${imageUrl}" alt="Concept map snapshot"></div>` : '',
      relationItems ? `<div class="links"><h2>Relation Links</h2><ul>${relationItems}</ul></div>` : '',
      '<h2>Outline Notes</h2>',
      outlineSections,
      '</body></html>'
    ].join('');
    const filename = safeFilename(db?.root?.title || 'outliner-export', 'outliner-export').replace(/\.docx?$/i, '') + '.doc';
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    downloadBlob(filename, blob);
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
    downloadBlob(filename, blob);
  }
  function downloadBlob(filename, blob) {
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
  function isEditableTarget(target) {
    if (!target || !(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }
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

  function updateNotesHeader() {
    const el = $('#noteNodeLabel');
    if (!el) return;
    const node = getNodeById(selection);
    el.textContent = node?.title || '(untitled)';
  }

  function getMapElements() {
    return {
      stage: $('#mapStage'),
      canvas: $('#mapCanvas'),
      parentEdgeLayer: $('#parentEdgeLayer'),
      relationEdgeLayer: $('#relationEdgeLayer'),
      nodeLayer: $('#nodeLayer')
    };
  }

  function centerOf(node) {
    const metrics = getNodeRenderMetrics(node);
    return {
      x: node.x + MAP_NODE_WIDTH / 2,
      y: node.y + metrics.height / 2
    };
  }

  function pointOnNodeBoundary(node, targetX, targetY, pad = 2) {
    const c = centerOf(node);
    const dx = targetX - c.x;
    const dy = targetY - c.y;
    if (dx === 0 && dy === 0) return c;
    const halfW = MAP_NODE_WIDTH / 2 + pad;
    const metrics = getNodeRenderMetrics(node);
    const halfH = metrics.height / 2 + pad;
    const scale = Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 0.0001);
    return {
      x: c.x + dx / scale,
      y: c.y + dy / scale
    };
  }

  function edgeEndpointsBetweenNodes(fromNode, toNode) {
    const fromCenter = centerOf(fromNode);
    const toCenter = centerOf(toNode);
    return {
      from: pointOnNodeBoundary(fromNode, toCenter.x, toCenter.y, 2),
      to: pointOnNodeBoundary(toNode, fromCenter.x, fromCenter.y, 2)
    };
  }

  function straightPathBetweenNodes(fromNode, toNode) {
    const endpoints = edgeEndpointsBetweenNodes(fromNode, toNode);
    return `M ${endpoints.from.x} ${endpoints.from.y} L ${endpoints.to.x} ${endpoints.to.y}`;
  }

  function computeDiagramBounds(padding = 0) {
    const records = collectNodeRecords();
    if (!records.length) {
      return {
        minX: 0,
        minY: 0,
        maxX: MAP_WORKSPACE_MIN_WIDTH,
        maxY: MAP_WORKSPACE_MIN_HEIGHT,
        width: MAP_WORKSPACE_MIN_WIDTH,
        height: MAP_WORKSPACE_MIN_HEIGHT
      };
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    records.forEach(({ node }) => {
      const metrics = getNodeRenderMetrics(node);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + MAP_NODE_WIDTH);
      maxY = Math.max(maxY, node.y + metrics.height);
    });
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    return { minX, minY, maxX, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  function updateMapWorkspaceBounds() {
    const { canvas } = getMapElements();
    if (!canvas) return;
    const contentBounds = computeDiagramBounds(MAP_WORKSPACE_PADDING);
    let minX = Math.min(0, contentBounds.minX);
    let minY = Math.min(0, contentBounds.minY);
    let width = Math.max(MAP_WORKSPACE_MIN_WIDTH, contentBounds.maxX - minX);
    let height = Math.max(MAP_WORKSPACE_MIN_HEIGHT, contentBounds.maxY - minY);
    if (!Number.isFinite(width) || width <= 0) { width = MAP_WORKSPACE_MIN_WIDTH; minX = 0; }
    if (!Number.isFinite(height) || height <= 0) { height = MAP_WORKSPACE_MIN_HEIGHT; minY = 0; }
    mapWorkspace = { minX, minY, width, height };
    canvas.setAttribute('viewBox', `${mapWorkspace.minX} ${mapWorkspace.minY} ${mapWorkspace.width} ${mapWorkspace.height}`);
  }

  function applyMapZoom() {
    const { canvas } = getMapElements();
    if (!canvas) return;
    const scaledWidth = Math.max(1, Math.round(mapWorkspace.width * mapZoom));
    const scaledHeight = Math.max(1, Math.round(mapWorkspace.height * mapZoom));
    canvas.style.width = `${scaledWidth}px`;
    canvas.style.height = `${scaledHeight}px`;
    updateMapPanCursor();
  }

  function getMapStageMetrics() {
    const { stage } = getMapElements();
    if (!stage) return { padLeft: 0, padTop: 0, availableWidth: 1, availableHeight: 1 };
    const styles = window.getComputedStyle(stage);
    const padLeft = parseFloat(styles.paddingLeft) || 0;
    const padRight = parseFloat(styles.paddingRight) || 0;
    const padTop = parseFloat(styles.paddingTop) || 0;
    const padBottom = parseFloat(styles.paddingBottom) || 0;
    return {
      padLeft,
      padRight,
      padTop,
      padBottom,
      availableWidth: Math.max(1, stage.clientWidth - padLeft - padRight),
      availableHeight: Math.max(1, stage.clientHeight - padTop - padBottom)
    };
  }

  function getZoomAnchorClientPoint() {
    const { stage } = getMapElements();
    if (!stage) return { x: 0, y: 0 };
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    if (mapPointerInside) return { x: mapPointerClientX, y: mapPointerClientY };
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function setMapZoomAtClientPoint(nextZoom, clientX, clientY) {
    const { stage } = getMapElements();
    if (!stage) return;
    if (Math.abs(nextZoom - mapZoom) < 0.0001) return;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      mapZoom = nextZoom;
      applyMapZoom();
      return;
    }
    const stageMetrics = getMapStageMetrics();
    const pointerX = clamp(clientX - rect.left - stageMetrics.padLeft, 0, stageMetrics.availableWidth);
    const pointerY = clamp(clientY - rect.top - stageMetrics.padTop, 0, stageMetrics.availableHeight);
    const contentX = (stage.scrollLeft + pointerX) / mapZoom;
    const contentY = (stage.scrollTop + pointerY) / mapZoom;
    mapZoom = nextZoom;
    applyMapZoom();
    const maxScrollLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
    const maxScrollTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
    stage.scrollLeft = clamp(contentX * mapZoom - pointerX, 0, maxScrollLeft);
    stage.scrollTop = clamp(contentY * mapZoom - pointerY, 0, maxScrollTop);
  }

  function zoomByStep(direction) {
    const zoomFactor = direction > 0 ? MAP_ZOOM_STEP : (1 / MAP_ZOOM_STEP);
    const nextZoom = clamp(mapZoom * zoomFactor, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
    const anchor = getZoomAnchorClientPoint();
    setMapZoomAtClientPoint(nextZoom, anchor.x, anchor.y);
  }

  function fitMapToViewport() {
    const { stage } = getMapElements();
    if (!stage) return;
    updateMapWorkspaceBounds();
    const stageMetrics = getMapStageMetrics();
    const diagram = computeDiagramBounds(MAP_FIT_PADDING);
    const fitZoom = Math.min(
      MAP_ZOOM_MAX,
      Math.max(
        MAP_ZOOM_MIN,
        Math.min(stageMetrics.availableWidth / diagram.width, stageMetrics.availableHeight / diagram.height)
      )
    );
    mapZoom = fitZoom;
    applyMapZoom();
    const diagramOffsetX = (diagram.minX - mapWorkspace.minX) * mapZoom;
    const diagramOffsetY = (diagram.minY - mapWorkspace.minY) * mapZoom;
    const diagramWidth = diagram.width * mapZoom;
    const diagramHeight = diagram.height * mapZoom;
    const nextScrollLeft = diagramOffsetX - Math.max(0, (stageMetrics.availableWidth - diagramWidth) / 2);
    const nextScrollTop = diagramOffsetY - Math.max(0, (stageMetrics.availableHeight - diagramHeight) / 2);
    const maxScrollLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
    const maxScrollTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
    stage.scrollLeft = clamp(nextScrollLeft, 0, maxScrollLeft);
    stage.scrollTop = clamp(nextScrollTop, 0, maxScrollTop);
  }

  function renderMapToolbarState() {
    const toggleBtn = $('#toggleDiagram');
    if (toggleBtn) {
      toggleBtn.textContent = diagramEnabled ? 'Disable Diagram' : 'Enable Diagram';
      toggleBtn.setAttribute('aria-pressed', diagramEnabled ? 'true' : 'false');
    }
    ['zoomOut', 'zoomIn', 'fitMap', 'autoArrange', 'deleteSelection'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = !diagramEnabled;
    });
    const undoBtn = $('#undoAction');
    if (undoBtn) undoBtn.disabled = undoHistory.length === 0;
  }

  function renderMap() {
    const { parentEdgeLayer, relationEdgeLayer, nodeLayer } = getMapElements();
    if (!parentEdgeLayer || !relationEdgeLayer || !nodeLayer) return;
    ensureMapFields();
    buildNodeRenderMetrics();
    updateMapWorkspaceBounds();
    applyMapZoom();
    clearChildren(parentEdgeLayer);
    clearChildren(relationEdgeLayer);
    clearChildren(nodeLayer);
    const records = collectNodeRecords();
    const byId = new Map(records.map(rec => [rec.node.id, rec.node]));
    const svgNs = 'http://www.w3.org/2000/svg';

    records.forEach(({ node, parent }) => {
      if (!parent) return;
      const path = document.createElementNS(svgNs, 'path');
      path.setAttribute('class', 'edge-parent');
      path.setAttribute('d', straightPathBetweenNodes(parent, node));
      parentEdgeLayer.appendChild(path);
    });

    db.links.forEach((link) => {
      const fromNode = byId.get(link.fromId);
      const toNode = byId.get(link.toId);
      if (!fromNode || !toNode) return;
      const path = document.createElementNS(svgNs, 'path');
      path.setAttribute('class', 'edge-relation' + (selectedRelationLinkId === link.id ? ' selected' : ''));
      path.setAttribute('d', straightPathBetweenNodes(fromNode, toNode));
      path.dataset.id = link.id;
      path.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedRelationLinkId = link.id;
        renderMap();
      });
      relationEdgeLayer.appendChild(path);
    });

    records.forEach(({ node }) => {
      const metrics = getNodeRenderMetrics(node);
      const g = document.createElementNS(svgNs, 'g');
      g.setAttribute('class', 'map-node' + (selection === node.id ? ' selected' : '') + (mapDrag?.dropParentId === node.id ? ' drop-target' : ''));
      g.setAttribute('transform', `translate(${node.x} ${node.y})`);
      g.dataset.id = node.id;

      const rect = document.createElementNS(svgNs, 'rect');
      rect.setAttribute('width', String(MAP_NODE_WIDTH));
      rect.setAttribute('height', String(metrics.height));
      g.appendChild(rect);

      const text = document.createElementNS(svgNs, 'text');
      text.setAttribute('x', String(MAP_NODE_WIDTH / 2));
      text.setAttribute('text-anchor', 'middle');
      const blockHeight = metrics.lines.length * NODE_TEXT_LINE_HEIGHT;
      const startY = Math.round((metrics.height - blockHeight) / 2 + NODE_TEXT_LINE_HEIGHT - 4);
      text.setAttribute('y', String(startY));
      metrics.lines.forEach((line, idx) => {
        const tspan = document.createElementNS(svgNs, 'tspan');
        tspan.setAttribute('x', String(MAP_NODE_WIDTH / 2));
        if (idx > 0) tspan.setAttribute('dy', String(NODE_TEXT_LINE_HEIGHT));
        tspan.textContent = line;
        text.appendChild(tspan);
      });
      g.appendChild(text);

      g.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleMapNodeClick(node.id);
      });
      g.addEventListener('pointerdown', (event) => onMapNodePointerDown(event, node.id));
      nodeLayer.appendChild(g);
    });

    renderMapToolbarState();
  }

  function handleMapNodeClick(nodeId) {
    if (!nodeId) return;
    selectedRelationLinkId = null;
    selectNode(nodeId);
  }

  function deleteCurrentSelection() {
    if (selectedRelationLinkId) {
      const before = db.links.length;
      db.links = db.links.filter(link => link.id !== selectedRelationLinkId);
      if (db.links.length !== before) {
        selectedRelationLinkId = null;
        save();
        renderMap();
        return true;
      }
      selectedRelationLinkId = null;
      renderMap();
      return false;
    }
    const before = selection;
    deleteNode();
    return before !== selection;
  }

  function onMapNodePointerDown(event, nodeId) {
    if (!diagramEnabled) return;
    if (event.button !== 0) return;
    const node = getNodeById(nodeId);
    if (!node) return;
    const point = toSvgPoint(event);
    mapDrag = {
      pointerId: event.pointerId,
      nodeId,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
      startX: node.x,
      startY: node.y,
      moved: false,
      dropParentId: null
    };
    event.preventDefault();
    event.stopPropagation();
    const { canvas } = getMapElements();
    try { canvas?.setPointerCapture(event.pointerId); } catch {}
  }

  function getPendingDropParentIdForDraggedNode(draggedNodeId) {
    const dragged = getNodeById(draggedNodeId);
    if (!dragged) return null;
    const metrics = getNodeRenderMetrics(dragged);
    const centerX = dragged.x + MAP_NODE_WIDTH / 2;
    const centerY = dragged.y + metrics.height / 2;
    const records = collectNodeRecords();
    for (let i = records.length - 1; i >= 0; i--) {
      const candidate = records[i].node;
      if (candidate.id === draggedNodeId) continue;
      if (isDescendant(dragged, candidate)) continue;
      const b = getNodeBounds(candidate);
      if (centerX >= b.left && centerX <= b.right && centerY >= b.top && centerY <= b.bottom) {
        return candidate.id;
      }
    }
    return null;
  }

  function reparentNodeOnDropTarget(draggedNodeId, parentId) {
    if (!draggedNodeId || !parentId || draggedNodeId === parentId) return false;
    const src = findNodeById(draggedNodeId);
    const dst = findNodeById(parentId);
    if (!src || !dst || !src.parent) return false;
    if (src.node.id === db.root.id) return false;
    if (isDescendant(src.node, dst.node)) return false;
    if (src.parent.id === dst.node.id) return false;
    src.parent.children.splice(src.index, 1);
    dst.node.children.push(src.node);
    dst.node.collapsed = false;
    return true;
  }

  function autoArrangeNodes() {
    if (!db?.root) return;
    buildNodeRenderMetrics();
    const spans = new Map();
    const nodeHeight = (node) => getNodeRenderMetrics(node).height;

    function computeSubtreeSpan(node) {
      const ownHeight = nodeHeight(node);
      if (!node?.children?.length) {
        spans.set(node.id, ownHeight);
        return ownHeight;
      }
      const childSpans = node.children.map((child) => computeSubtreeSpan(child));
      const childrenBand = childSpans.reduce((sum, val) => sum + val, 0)
        + AUTO_ARRANGE_SIBLING_GAP * Math.max(0, childSpans.length - 1);
      const span = Math.max(ownHeight, childrenBand);
      spans.set(node.id, span);
      return span;
    }

    function assignPositions(node, depth, top) {
      const span = spans.get(node.id) || MAP_NODE_MIN_HEIGHT;
      const ownHeight = nodeHeight(node);
      node.x = Math.round(AUTO_ARRANGE_LEFT + depth * AUTO_ARRANGE_COLUMN_GAP);

      if (!node.children.length) {
        const centerY = top + span / 2;
        node.y = Math.round(centerY - ownHeight / 2);
        return;
      }

      const childSpans = node.children.map((child) => spans.get(child.id) || nodeHeight(child));
      const childrenBand = childSpans.reduce((sum, val) => sum + val, 0)
        + AUTO_ARRANGE_SIBLING_GAP * Math.max(0, childSpans.length - 1);
      let cursor = top + Math.max(0, (span - childrenBand) / 2);
      node.children.forEach((child, index) => {
        assignPositions(child, depth + 1, cursor);
        cursor += childSpans[index] + AUTO_ARRANGE_SIBLING_GAP;
      });

      const first = node.children[0];
      const last = node.children[node.children.length - 1];
      const firstCenter = first.y + nodeHeight(first) / 2;
      const lastCenter = last.y + nodeHeight(last) / 2;
      const centerY = (firstCenter + lastCenter) / 2;
      node.y = Math.round(centerY - ownHeight / 2);
    }

    computeSubtreeSpan(db.root);
    assignPositions(db.root, 0, AUTO_ARRANGE_TOP);
  }

  function createUndoSnapshot() {
    return {
      db: clone(db),
      selection
    };
  }

  function snapshotsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function recordUndoSnapshotIfChanged() {
    const next = createUndoSnapshot();
    if (!currentSnapshot) {
      currentSnapshot = next;
      renderMapToolbarState();
      return;
    }
    if (snapshotsEqual(currentSnapshot, next)) return;
    undoHistory.push(currentSnapshot);
    if (undoHistory.length > MAX_UNDO_HISTORY) undoHistory.shift();
    currentSnapshot = next;
    renderMapToolbarState();
  }

  function undoLastChange() {
    if (!undoHistory.length) return;
    const previous = undoHistory.pop();
    db = sanitizeDbState(previous.db);
    selection = normalizeSelection(previous.selection);
    ensureMapFields();
    currentSnapshot = createUndoSnapshot();
    save({ silent: true });
    selectNode(selection, { forceRender: true, forceEditor: true, forceMap: true });
    renderMapToolbarState();
  }

  function canPanMapStage() {
    const { stage } = getMapElements();
    if (!stage) return false;
    return stage.scrollWidth > stage.clientWidth + 1 || stage.scrollHeight > stage.clientHeight + 1;
  }

  function updateMapPanCursor() {
    const { stage } = getMapElements();
    if (!stage) return;
    stage.style.cursor = mapPan ? 'grabbing' : (canPanMapStage() ? 'grab' : 'default');
  }

  function getNotesPanelMaxHeight() {
    const editorPane = $('#editorPane');
    const notesPanel = $('#notesPanel');
    if (!editorPane || !notesPanel) return NOTES_PANEL_DEFAULT_HEIGHT;
    const total = editorPane.clientHeight || 0;
    if (!total) return NOTES_PANEL_DEFAULT_HEIGHT;
    const resizeHandle = $('#notesResizeHandle');
    const handleHeight = resizeHandle?.offsetHeight || 0;
    const reserved = NOTES_PANEL_MIN_MAP_HEIGHT + handleHeight + 12;
    return Math.max(NOTES_PANEL_MIN_HEIGHT, total - reserved);
  }

  function applyNotesPanelHeight() {
    const notesPanel = $('#notesPanel');
    if (!notesPanel) return;
    if (!diagramEnabled) {
      notesPanel.style.height = '';
      notesPanel.style.flex = '';
      return;
    }
    const maxHeight = getNotesPanelMaxHeight();
    notesPanelHeight = clamp(notesPanelHeight, NOTES_PANEL_MIN_HEIGHT, maxHeight);
    const roundedHeight = Math.round(notesPanelHeight);
    // Keep explicit flex-basis in sync with height so resize works consistently in Edge.
    notesPanel.style.flex = `0 0 ${roundedHeight}px`;
    notesPanel.style.height = `${roundedHeight}px`;
  }

  function setDiagramEnabled(enabled) {
    diagramEnabled = !!enabled;
    const editorPane = $('#editorPane');
    if (editorPane) editorPane.classList.toggle('diagram-disabled', !diagramEnabled);
    if (!diagramEnabled) {
      const notesPanel = $('#notesPanel');
      const handle = $('#notesResizeHandle');
      const pointerId = notesResize?.pointerId;
      mapPan = null;
      mapDrag = null;
      notesResize = null;
      notesPanel?.classList.remove('resizing');
      try { if (pointerId != null && handle?.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId); } catch {}
      updateMapPanCursor();
    } else {
      applyNotesPanelHeight();
      requestAnimationFrame(() => fitMapToViewport());
    }
    renderMapToolbarState();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toSvgPoint(event) {
    const { canvas } = getMapElements();
    if (!canvas) return { x: 0, y: 0 };
    const point = canvas.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = canvas.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
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
    if (inlineRename?.input && e.target === inlineRename.input) return;
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
      beginInlineRename(selection);
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
      db = { root: createNode('Root', { x: 120, y: 120 }), links: [] };
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

    $('#exportWord')?.addEventListener('click', () => { exportWordDocument(); });
    $('#zoomOut')?.addEventListener('click', () => zoomByStep(-1));
    $('#zoomIn')?.addEventListener('click', () => zoomByStep(1));
    $('#fitMap')?.addEventListener('click', () => fitMapToViewport());
    $('#autoArrange')?.addEventListener('click', () => {
      autoArrangeNodes();
      save();
      renderMap();
    });
    $('#toggleDiagram')?.addEventListener('click', () => setDiagramEnabled(!diagramEnabled));
    $('#deleteSelection')?.addEventListener('click', () => { deleteCurrentSelection(); });
    $('#undoAction')?.addEventListener('click', () => undoLastChange());
    $('#notesResizeHandle')?.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !diagramEnabled) return;
      const notesPanel = $('#notesPanel');
      const handle = $('#notesResizeHandle');
      if (!notesPanel || !handle) return;
      notesResize = {
        pointerId: event.pointerId,
        startClientY: event.clientY,
        startHeight: notesPanel.getBoundingClientRect().height || notesPanelHeight
      };
      notesPanel.classList.add('resizing');
      event.preventDefault();
      try { handle.setPointerCapture(event.pointerId); } catch {}
    });

    $('#mapStage')?.addEventListener('pointerenter', (event) => {
      if (!diagramEnabled) return;
      mapPointerInside = true;
      mapPointerClientX = event.clientX;
      mapPointerClientY = event.clientY;
    });
    $('#mapStage')?.addEventListener('pointermove', (event) => {
      if (!diagramEnabled) return;
      mapPointerInside = true;
      mapPointerClientX = event.clientX;
      mapPointerClientY = event.clientY;
    });
    $('#mapStage')?.addEventListener('pointerleave', () => {
      mapPointerInside = false;
    });
    $('#mapCanvas')?.addEventListener('click', (event) => {
      if (!diagramEnabled) return;
      if (suppressNextMapCanvasClick) {
        suppressNextMapCanvasClick = false;
        return;
      }
      if (event.target.closest('.map-node') || event.target.closest('.edge-relation')) return;
      selectedRelationLinkId = null;
      renderMap();
    });
    $('#mapCanvas')?.addEventListener('pointerdown', (event) => {
      if (!diagramEnabled) return;
      if (event.button !== 0) return;
      const { canvas, stage } = getMapElements();
      if (!canvas || !stage) return;
      if (event.target !== canvas) return;
      if (!canPanMapStage()) return;
      mapPan = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startScrollLeft: stage.scrollLeft,
        startScrollTop: stage.scrollTop,
        moved: false
      };
      event.preventDefault();
      try { canvas.setPointerCapture(event.pointerId); } catch {}
      updateMapPanCursor();
    });

    window.addEventListener('pointermove', (event) => {
      if (notesResize && event.pointerId === notesResize.pointerId) {
        const notesPanel = $('#notesPanel');
        if (notesPanel) {
          const deltaY = notesResize.startClientY - event.clientY;
          notesPanelHeight = notesResize.startHeight + deltaY;
          applyNotesPanelHeight();
          event.preventDefault();
        }
        return;
      }

      const { stage } = getMapElements();
      if (!stage) return;
      if (!diagramEnabled) return;
      if (mapPan && event.pointerId === mapPan.pointerId) {
        const dx = event.clientX - mapPan.startClientX;
        const dy = event.clientY - mapPan.startClientY;
        if (!mapPan.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
          mapPan.moved = true;
          suppressNextMapCanvasClick = true;
        }
        const maxScrollLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
        const maxScrollTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
        stage.scrollLeft = clamp(mapPan.startScrollLeft - dx, 0, maxScrollLeft);
        stage.scrollTop = clamp(mapPan.startScrollTop - dy, 0, maxScrollTop);
        event.preventDefault();
        return;
      }
      if (!mapDrag || event.pointerId !== mapDrag.pointerId) return;
      const node = getNodeById(mapDrag.nodeId);
      if (!node) {
        mapDrag = null;
        renderMap();
        return;
      }
      const point = toSvgPoint(event);
      node.x = Math.round(point.x - mapDrag.offsetX);
      node.y = Math.round(point.y - mapDrag.offsetY);
      mapDrag.dropParentId = getPendingDropParentIdForDraggedNode(node.id);
      if (!mapDrag.moved) {
        const movedX = Math.abs(node.x - mapDrag.startX);
        const movedY = Math.abs(node.y - mapDrag.startY);
        if (movedX > 2 || movedY > 2) {
          mapDrag.moved = true;
          suppressNextMapCanvasClick = true;
        }
      }
      renderMap();
      event.preventDefault();
    });

    window.addEventListener('pointerup', (event) => {
      if (notesResize && event.pointerId === notesResize.pointerId) {
        const notesPanel = $('#notesPanel');
        const handle = $('#notesResizeHandle');
        const pointerId = notesResize.pointerId;
        notesResize = null;
        notesPanel?.classList.remove('resizing');
        try { if (handle?.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId); } catch {}
      }

      const { canvas } = getMapElements();
      if (!diagramEnabled) return;
      if (mapPan && event.pointerId === mapPan.pointerId) {
        const pointerId = mapPan.pointerId;
        mapPan = null;
        try { if (canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId); } catch {}
        updateMapPanCursor();
      }
      if (!mapDrag || event.pointerId !== mapDrag.pointerId) return;
      const dragState = mapDrag;
      mapDrag = null;
      const changedParent = reparentNodeOnDropTarget(dragState.nodeId, dragState.dropParentId);
      if (changedParent) autoArrangeNodes();
      if (dragState.moved || changedParent) {
        recordUndoSnapshotIfChanged();
        save({ silent: true, skipHistory: true });
      }
      selectNode(dragState.nodeId, { forceRender: true, forceMap: true });
      try { if (canvas?.hasPointerCapture(dragState.pointerId)) canvas.releasePointerCapture(dragState.pointerId); } catch {}
      updateMapPanCursor();
    });

    window.addEventListener('pointercancel', (event) => {
      if (notesResize && event.pointerId === notesResize.pointerId) {
        const notesPanel = $('#notesPanel');
        const handle = $('#notesResizeHandle');
        const pointerId = notesResize.pointerId;
        notesResize = null;
        notesPanel?.classList.remove('resizing');
        try { if (handle?.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId); } catch {}
      }

      const { canvas } = getMapElements();
      if (!diagramEnabled) return;
      if (mapPan && event.pointerId === mapPan.pointerId) {
        const pointerId = mapPan.pointerId;
        mapPan = null;
        try { if (canvas?.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId); } catch {}
      }
      if (mapDrag && event.pointerId === mapDrag.pointerId) {
        mapDrag = null;
      }
      updateMapPanCursor();
      renderMap();
    });

    window.addEventListener('resize', () => {
      applyNotesPanelHeight();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const isUndoShortcut = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z';
      if (isUndoShortcut && !isEditableTarget(e.target)) {
        e.preventDefault();
        undoLastChange();
        return;
      }

      const isPlainZoomKey = !e.ctrlKey && !e.metaKey && !e.altKey;
      const isZoomInShortcut = isPlainZoomKey && (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd');
      const isZoomOutShortcut = isPlainZoomKey && (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract');
      if (diagramEnabled && (isZoomInShortcut || isZoomOutShortcut) && !isEditableTarget(e.target)) {
        e.preventDefault();
        zoomByStep(isZoomInShortcut ? 1 : -1);
        return;
      }

      const inEditor = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.sun-editor'));
      const inSearch = document.activeElement === $('#search');
      const inTree = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#tree'));
      if (!inEditor && !inSearch && !inTree) {
        if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); addSibling(); }
        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addChild(); }
        if (e.key === 'F2') {
          e.preventDefault();
          beginInlineRename(selection);
        }
        if (e.key === 'Delete') { e.preventDefault(); deleteCurrentSelection(); }
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
    ensureMapFields();
    selection = normalizeSelection(selection);
    currentSnapshot = createUndoSnapshot();
    renderMapToolbarState();
    bindUI();
    selectNode(selection, { forceRender: true, forceEditor: true, forceMap: true });
    setDiagramEnabled(diagramEnabled);
    applyNotesPanelHeight();
    requestAnimationFrame(() => fitMapToViewport());
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
        ['table', 'link', 'math'],
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
