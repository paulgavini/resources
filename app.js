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
    status(`Selected: ${findNodeById(id)?.node.title || ''}`);
  }

  function updateEditor() {
    const { node } = findNodeById(selection) || {};
    if (!node) return;
    $('#titleInput').value = node.title;
    const editor = $('#editor');
    const overlay = editor.querySelector('.img-resizer');
    editor.innerHTML = node.content || '';
    if (overlay) editor.appendChild(overlay);
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
    f.node.content = editor.innerHTML;
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ db, selection }));
    if (!opts.silent) status('Saved');
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.db?.root?.id) {
        db = parsed.db;
        selection = parsed.selection || db.root.id;
      }
    } catch (e) {
      console.warn('Failed to load saved DB', e);
    }
  }

  // Import/Export JSON
  function exportJson() {
    const data = JSON.stringify(db, null, 2);
    downloadText('treepad-web.json', data);
  }
  function importJsonFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (!obj?.root?.id) throw new Error('Invalid DB');
        db = obj;
        selection = db.root.id;
        save();
        renderTree();
        updateEditor();
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
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

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
    $('#renameNode').addEventListener('click', renameNode);
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

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const inEditor = document.activeElement === $('#editor') || $('#editor').contains(document.activeElement);
      const inTitle = document.activeElement === $('#titleInput');
      const inSearch = document.activeElement === $('#search');
      if (!inEditor && !inTitle && !inSearch) {
        if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); addSibling(); }
        if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); addChild(); }
        if (e.key === 'F2') { e.preventDefault(); renameNode(); }
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

  function init() {
    load();
    if (!selection) selection = db.root.id;
    renderTree();
    selectNode(selection);
    bindUI();
    try { document.execCommand('enableObjectResizing', false, true); } catch (e) {}
    try { document.execCommand('enableInlineTableEditing', false, true); } catch (e) {}
    setupImageResizerFallback();
    status('Loaded');
  }

  document.addEventListener('DOMContentLoaded', init);

  // Insert image file at caret
  function insertImageFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        document.execCommand('insertHTML', false, `<img src="${dataUrl}" alt="${escapeHtml(file.name)}">`);
        onEditorInput();
        resolve();
      };
      reader.readAsDataURL(file);
    });
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
    let out = esc(s);
    out = greek(out);
    out = latexArrows(out);
    out = textArrows(out);
    for (let i=0;i<3;i++){ out = fracOnce(out); out = sqrtOnce(out); }
    out = superSub(out);
    return out;
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
