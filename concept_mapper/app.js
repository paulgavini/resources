(() => {
  "use strict";

  const STORAGE_KEY = "concept-mapper-map-v1";
  const LAYOUT_KEY = "concept-mapper-layout-v1";
  const HANDLE_DB = "concept-mapper-file-handles-v1";
  const HANDLE_STORE = "handles";
  const ACTIVE_HANDLE_KEY = "active-concept-map-file";
  const SVG_NS = "http://www.w3.org/2000/svg";
  const ROOT_TEXT = "Central idea";
  const ROOT_NODE_WIDTH = 220;
  const BRANCH_GAP = 90;
  const VERTICAL_BRANCH_GAP = 6;
  const textMeasureContext = document.createElement("canvas").getContext("2d");
  const els = Object.fromEntries([
    "mapCanvas", "mapContent", "outlineView", "mapShell", "mapViewButton", "outlineViewButton", "canvasWrap", "emptyHint", "mapStatus", "zoomLabel",
    "addChildButton", "addSiblingButton", "editNodeButton", "deleteNodeButton", "moveConceptUpButton", "moveConceptDownButton", "outdentConceptButton", "indentConceptButton", "balancedLayoutButton", "rightLayoutButton",
    "emptyAddButton", "newMapButton", "openMapButton", "saveMapButton", "reloadFileButton", "fileSaveStatus", "fileSaveLabel", "exportButton", "exportWordButton",
    "openFileInput", "zoomInButton", "zoomOutButton", "fitButton", "undoButton", "redoButton", "editDialog", "connectionDialog",
    "editForm", "nodeTextInput", "relationLabelField", "relationLabelInput", "nodeNotesInput", "closeDialogButton", "cancelEditButton",
    "connectionForm", "connectionContext", "connectionLabelInput", "closeConnectionButton", "cancelConnectionButton"
  ].map(id => [id, document.getElementById(id)]));

  let map = freshMap();
  let selectedId = map.root.id;
  let layout = null;
  let view = null;
  let pan = null;
  let history = [];
  let future = [];
  let editingId = null;
  let editingConnectionId = null;
  let activeView = "map";
  let layoutMode = "balanced";
  const collapsedIds = new Set();
  let draggedId = null;
  let linkedFileHandle = null;
  let fileHandlePersisted = false;
  let fileWriteQueue = Promise.resolve();
  let fileBaseSignatures = new WeakMap();
  let fileConflict = false;
  let fileDirty = false;
  let stateGeneration = 0;
  let fileSaveTimer = 0;
  let importedFileName = null;
  let fileRestoreComplete = false;
  let suspendFileTracking = false;

  function freshMap() {
    return { format: "concept-mapper", version: 1, title: ROOT_TEXT, root: { id: makeId(), text: ROOT_TEXT, relationLabel: "", notes: "", children: [] } };
  }

  function makeId() {
    return `node-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`}`;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function findNode(id, node = map.root, parent = null) {
    if (node.id === id) return { node, parent };
    for (const child of node.children || []) {
      const found = findNode(id, child, node);
      if (found) return found;
    }
    return null;
  }

  function remember() {
    history.push(clone(map));
    if (history.length > 80) history.shift();
    future = [];
  }

  function commit() {
    saveLocal();
    render(true);
    if (!suspendFileTracking) markMapEdited();
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
      els.mapStatus.textContent = "Use Save As to keep a copy of your work";
    }
  }

  function validMap(value) {
    if (!value || value.format !== "concept-mapper" || value.version !== 1 || !value.root || typeof value.root.text !== "string") return false;
    const seen = new Set();
    const visit = node => {
      if (!node || typeof node.id !== "string" || !node.id || seen.has(node.id) || typeof node.text !== "string" || (node.notes !== undefined && typeof node.notes !== "string") || (node.relationLabel !== undefined && (typeof node.relationLabel !== "string" || node.relationLabel.length > 40)) || !Array.isArray(node.children)) return false;
      seen.add(node.id);
      return node.children.every(visit);
    };
    return visit(value.root);
  }

  function escText(text) {
    return String(text ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
  }

  const NOTE_TAGS = new Set(["B", "STRONG", "I", "EM", "UL", "OL", "LI", "SUP", "SUB", "BR", "P", "DIV"]);

  function safeNotesHtml(value) {
    const source = String(value ?? "");
    if (!source.trim()) return "";
    const parsed = document.createElement("div");
    parsed.innerHTML = source;
    if (!parsed.querySelector("b,strong,i,em,ul,ol,li,sup,sub,br,p,div")) {
      return escText(source).replace(/\r?\n/g, "<br>");
    }
    const serialize = node => {
      if (node.nodeType === Node.TEXT_NODE) return escText(node.nodeValue).replace(/\r?\n/g, "<br>");
      if (node.nodeType !== Node.ELEMENT_NODE || !NOTE_TAGS.has(node.tagName)) return [...node.childNodes].map(serialize).join("");
      if (node.tagName === "BR") return "<br>";
      const tag = node.tagName === "DIV" ? "p" : node.tagName.toLowerCase();
      return `<${tag}>${[...node.childNodes].map(serialize).join("")}</${tag}>`;
    };
    return [...parsed.childNodes].map(serialize).join("");
  }

  function notesToPlainText(value) {
    const parsed = document.createElement("div");
    parsed.innerHTML = safeNotesHtml(value);
    const read = node => {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
      if (node.nodeType !== Node.ELEMENT_NODE) return [...node.childNodes].map(read).join("");
      if (node.tagName === "BR") return "\n";
      if (node.tagName === "LI") {
        const parent = node.parentElement;
        const siblings = parent ? [...parent.children].filter(child => child.tagName === "LI") : [];
        const marker = parent?.tagName === "OL" ? `${siblings.indexOf(node) + 1}. ` : "• ";
        return `${marker}${[...node.childNodes].map(read).join("").trim()}\n`;
      }
      if (node.tagName === "P" || node.tagName === "DIV") return `${[...node.childNodes].map(read).join("")}\n`;
      return [...node.childNodes].map(read).join("");
    };
    return [...parsed.childNodes].map(read).join("").trim();
  }

  function svgEl(tag, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
    return element;
  }

  function wrapText(value, maxChars = 28) {
    const explicit = String(value || "").split("\n");
    const lines = [];
    for (const para of explicit) {
      const words = para.split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(""); continue; }
      let line = "";
      for (const word of words) {
        if (word.length > maxChars) {
          if (line) { lines.push(line); line = ""; }
          let remaining = word;
          while (remaining.length > maxChars) {
            lines.push(remaining.slice(0, maxChars));
            remaining = remaining.slice(maxChars);
          }
          line = remaining;
          continue;
        }
        if (line && `${line} ${word}`.length > maxChars) { lines.push(line); line = word; }
        else line += `${line ? " " : ""}${word}`;
      }
      lines.push(line);
    }
    return lines;
  }

  function textContentWidth(text, depth = 2, root = false) {
    if (!textMeasureContext) return wrapText(text, root ? 23 : 30).reduce((widest, line) => Math.max(widest, line.length * (root ? 8 : 7)), 0);
    textMeasureContext.font = root ? '800 16px "Manrope", "Segoe UI", sans-serif' : `${depth === 1 ? "700 13px" : "400 12px"} "DM Sans", "Segoe UI", sans-serif`;
    return wrapText(text, root ? 23 : 30).reduce((widest, line) => Math.max(widest, textMeasureContext.measureText(line).width), 0);
  }

  function textWidth(text, root = false, depth = 2, hasNotes = false, measuredContentWidth = null) {
    if (root) return ROOT_NODE_WIDTH;
    const contentWidth = measuredContentWidth ?? textContentWidth(text, depth);
    const reservedNoteWidth = hasNotes ? 28 : 0;
    return Math.min(300, Math.max(hasNotes ? 72 : 44, contentWidth + 16 + reservedNoteWidth));
  }

  function subtreeHeight(node) {
    const labelHeight = Math.max(24, wrapText(node.text || " ", 30).length * 17 + 4);
    const nodePadding = 4;
    if (!node.children?.length) return labelHeight + nodePadding;
    const sum = node.children.reduce((total, child) => total + subtreeHeight(child), 0) + (node.children.length - 1) * VERTICAL_BRANCH_GAP;
    return Math.max(labelHeight + nodePadding, sum);
  }

  function maxDepth(node, depth = 0) {
    return (node.children || []).reduce((best, child) => Math.max(best, maxDepth(child, depth + 1)), depth);
  }

  function calculateLayout() {
    const roots = map.root.children || [];
    const sides = { 1: [], "-1": [] };
    roots.forEach((node, index) => sides[layoutMode === "right" ? 1 : index % 2 === 0 ? 1 : -1].push(node));
    const heightOfSide = side => side.reduce((sum, node) => sum + subtreeHeight(node), 0) + Math.max(0, side.length - 1) * VERTICAL_BRANCH_GAP;
    const totalHeight = Math.max(520, heightOfSide(sides[1]), heightOfSide(sides[-1]));
    const rootY = totalHeight / 2;
    const maxD = maxDepth(map.root);
    const outer = 150;
    const maxWidthsByDepth = [];
    const nodeWidths = new Map();
    const nodeContentWidths = new Map();
    const nodeNotes = new Map();
    const collectWidths = (node, depth = 0) => {
      const noteText = notesToPlainText(node.notes);
      const contentWidth = depth === 0 ? 0 : textContentWidth(node.text, depth);
      const width = textWidth(node.text, depth === 0, depth, Boolean(noteText), contentWidth);
      nodeNotes.set(node.id, noteText);
      nodeContentWidths.set(node.id, contentWidth);
      nodeWidths.set(node.id, width);
      maxWidthsByDepth[depth] = Math.max(maxWidthsByDepth[depth] || 0, width);
      (node.children || []).forEach(child => collectWidths(child, depth + 1));
    };
    collectWidths(map.root);
    let branchReach = ROOT_NODE_WIDTH / 2;
    for (let depth = 1; depth <= maxD; depth++) branchReach += BRANCH_GAP + 7 + (maxWidthsByDepth[depth] || 0);
    const rootX = outer + (layoutMode === "right" ? ROOT_NODE_WIDTH / 2 : branchReach);
    const nodes = [];
    const paths = [];

    const place = (node, depth, side, centerY, parent) => {
      const root = depth === 0;
      const lines = wrapText(node.text || " ", root ? 23 : 30);
      const width = nodeWidths.get(node.id) ?? ROOT_NODE_WIDTH;
      let x;
      if (root) x = rootX;
      else {
        const parentEdge = parent.root ? ROOT_NODE_WIDTH / 2 : parent.width;
        x = parent.x + side * (parentEdge + BRANCH_GAP + 7);
      }
      const nodeInfo = { node, parent, depth, side, x, y: centerY, width, height: root ? 54 : Math.max(24, lines.length * 17 + 4), lines, root, notesText: nodeNotes.get(node.id) || "", contentWidth: nodeContentWidths.get(node.id) || 0 };
      nodes.push(nodeInfo);

      if (depth > 0 && node.children?.length) {
        const groupHeight = node.children.reduce((sum, child) => sum + subtreeHeight(child), 0) + (node.children.length - 1) * VERTICAL_BRANCH_GAP;
        let cursor = centerY - groupHeight / 2;
        for (const child of node.children) {
          const childHeight = subtreeHeight(child);
          const childY = cursor + childHeight / 2;
          place(child, depth + 1, side, childY, nodeInfo);
          cursor += childHeight + VERTICAL_BRANCH_GAP;
        }
      }
      return nodeInfo;
    };

    place(map.root, 0, 1, rootY, null);
    for (const sideKey of [1, -1]) {
      const rootsOnSide = sides[sideKey];
      const groupHeight = heightOfSide(rootsOnSide);
      let cursor = rootY - groupHeight / 2;
      for (const child of rootsOnSide) {
        const h = subtreeHeight(child);
        const childY = cursor + h / 2;
        const childInfo = place(child, 1, Number(sideKey), childY, nodes[0]);
        paths.push({ parent: nodes[0], child: childInfo, side: Number(sideKey), rootBranch: true });
        cursor += h + VERTICAL_BRANCH_GAP;
      }
    }
    const byId = new Map(nodes.map(item => [item.node.id, item]));
    for (const item of nodes) {
      if (!item.parent || item.depth === 1) continue;
      const parentInfo = byId.get(item.parent.node.id);
      paths.push({ parent: parentInfo, child: item, side: item.side, rootBranch: false });
    }

    const pad = 70;
    const width = Math.max(720, rootX + branchReach + outer);
    const height = Math.max(520, totalHeight + pad * 2);
    return { nodes, paths, rootX, rootY, width, height, pad };
  }

  function viewBoxString(v) { return `${v.x} ${v.y} ${v.width} ${v.height}`; }

  function fitView() {
    if (!layout) return;
    const rect = els.canvasWrap.getBoundingClientRect();
    const aspect = Math.max(0.5, rect.width / Math.max(320, rect.height));
    let width = Math.max(layout.width + 70, 1450);
    let height = Math.max(layout.height + 70, 950);
    if (width / height < aspect) width = height * aspect;
    else height = width / aspect;
    view = { x: layout.width / 2 - width / 2, y: layout.height / 2 - height / 2, width, height };
    setView();
  }

  function setView() {
    if (!view) return;
    els.mapCanvas.setAttribute("viewBox", viewBoxString(view));
    els.zoomLabel.textContent = `${Math.round((layout.width + 70) / view.width * 100)}%`;
  }

  function zoom(factor) {
    if (!view) return;
    const rect = els.canvasWrap.getBoundingClientRect();
    const nextWidth = Math.max(320, Math.min(6000, view.width * factor));
    const nextHeight = nextWidth * view.height / view.width;
    const centerX = view.x + view.width / 2;
    const centerY = view.y + view.height / 2;
    view = { x: centerX - nextWidth / 2, y: centerY - nextHeight / 2, width: nextWidth, height: nextHeight };
    setView();
  }

  function drawPath(pathInfo) {
    const { parent, child, side, rootBranch } = pathInfo;
    const startX = parent.root ? parent.x + side * (rootWidthSafe(parent) / 2) : parent.x + side * parent.width;
    const endX = child.x - side * 7;
    const control = Math.max(25, Math.abs(endX - startX) * .44);
    const d = `M ${startX} ${parent.y} C ${startX + side * control} ${parent.y}, ${endX - side * control} ${child.y}, ${endX} ${child.y}`;
    const group = svgEl("g", { class: "connector-group" });
    const relationLabel = String(child.node.relationLabel || "").trim();
    const hitTarget = svgEl("path", {
      d,
      class: "connector-hit",
      tabindex: "0",
      role: "button",
      "aria-label": `Edit connection from ${parent.node.text} to ${child.node.text}${relationLabel ? `, labeled ${relationLabel}` : ", unlabeled"}`
    });
    const editConnection = event => {
      event.stopPropagation();
      selectNode(child.node.id);
      openConnectionEditor(child.node.id);
    };
    group.addEventListener("click", editConnection);
    hitTarget.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        editConnection(event);
      }
    });
    group.appendChild(hitTarget);
    group.appendChild(svgEl("path", { d, class: `node-branch${rootBranch ? " root-branch" : ""}` }));
    if (relationLabel) {
      const lines = wrapText(relationLabel, 20);
      const lineHeight = 12;
      const labelWidth = Math.max(36, Math.min(132, Math.max(...lines.map(line => line.length)) * 6.2 + 12));
      const labelHeight = lines.length * lineHeight + 6;
      const labelX = (startX + endX) / 2;
      const labelY = (parent.y + child.y) / 2;
      group.appendChild(svgEl("rect", { class: "connection-label-back", x: labelX - labelWidth / 2, y: labelY - labelHeight / 2, width: labelWidth, height: labelHeight, rx: 5 }));
      const text = svgEl("text", { class: "connection-label", x: labelX, y: labelY - ((lines.length - 1) * lineHeight) / 2 });
      lines.forEach((line, index) => {
        const span = svgEl("tspan", { x: labelX, dy: index === 0 ? "0" : String(lineHeight) });
        span.textContent = line;
        text.appendChild(span);
      });
      group.appendChild(text);
    }
    return group;
  }

  function rootWidthSafe(node) { return node.root ? ROOT_NODE_WIDTH : node.width; }

  function renderNode(info) {
    const { node, x, y, width, height, lines, root, side, depth, notesText: noteText, contentWidth } = info;
    const hasNotes = Boolean(noteText);
    const hasRelationLabel = Boolean(node.relationLabel && !root);
    const ariaDetails = [hasRelationLabel ? `Relationship to parent: ${node.relationLabel}` : "", hasNotes ? "has notes" : ""].filter(Boolean).join(", ");
    const g = svgEl("g", { class: `node-group${root ? " root-node" : ""}${depth === 1 ? " main-topic-node" : ""}${node.id === selectedId ? " selected" : ""}`, "data-node-id": node.id, tabindex: "0", role: "button", "aria-label": `${node.text}, ${node.children.length} child concepts${ariaDetails ? `, ${ariaDetails}` : ""}` });
    if (hasNotes || hasRelationLabel) {
      const title = svgEl("title");
      title.textContent = `${node.text}${hasRelationLabel ? `\nRelationship to parent: ${node.relationLabel}` : ""}${hasNotes ? `\n${noteText}` : ""}`;
      g.appendChild(title);
    }
    const x0 = root ? x - width / 2 : (side === 1 ? x - 8 : x - width + 8);
    const y0 = y - height / 2;
    const rect = svgEl("rect", { class: "node-hit", x: x0, y: y0, width: root ? width : width + 4, height, rx: root ? 40 : 7 });
    g.appendChild(rect);

    const anchor = root ? "middle" : side === 1 ? "start" : "end";
    const labelX = root ? x + (hasNotes ? 8 : 0) : side === 1 ? x + (hasNotes ? 24 : 0) : x;
    const lineHeight = root ? 21 : 17;
    const firstY = y - ((lines.length - 1) * lineHeight) / 2;
    const text = svgEl("text", { class: `node-label${root ? " root-label" : depth === 1 ? " main-topic" : ""}`, x: labelX, y: firstY, "text-anchor": anchor });
    lines.forEach((line, index) => {
      const span = svgEl("tspan", { x: labelX, dy: index === 0 ? "0" : String(lineHeight) });
      span.textContent = line;
      text.appendChild(span);
    });
    g.appendChild(text);
    if (hasNotes) {
      const noteX = root ? labelX - textContentWidth(node.text, depth, true) / 2 - 10 : side === 1 ? x + 11 : x - contentWidth - 10;
      const noteY = y;
      const marker = svgEl("g", { class: "node-note-indicator", "aria-hidden": "true" });
      marker.append(
        svgEl("rect", { x: noteX - 5, y: noteY - 6, width: 10, height: 12, rx: 2 }),
        svgEl("path", { d: `M ${noteX - 2.5} ${noteY - 2} H ${noteX + 2.5} M ${noteX - 2.5} ${noteY + 1} H ${noteX + 2.5} M ${noteX - 2.5} ${noteY + 4} H ${noteX + 1}` })
      );
      g.appendChild(marker);
    }
    g.addEventListener("click", event => {
      if (event.target.closest?.(".node-add-dot")) return;
      selectedId = node.id;
      render(false);
      els.mapContent.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`)?.focus();
    });
    g.addEventListener("dblclick", event => { event.stopPropagation(); selectNode(node.id); openEditor(); });
    const hotX = root ? x + width / 2 + 14 : (side === 1 ? x + width + 24 : x - width - 24);
    const hotY = y;
    const dot = svgEl("circle", { class: "node-add-dot", cx: hotX, cy: hotY, r: 10, tabindex: "0", role: "button", "aria-label": `Add child to ${node.text}`, "data-add-child": node.id });
    const plus = svgEl("path", { class: "node-add-plus", d: `M ${hotX - 4} ${hotY} H ${hotX + 4} M ${hotX} ${hotY - 4} V ${hotY + 4}` });
    dot.addEventListener("click", event => { event.stopPropagation(); addChild(node.id); });
    dot.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); addChild(node.id); } });
    g.append(dot, plus);
    return g;
  }

  function isInSubtree(root, candidateId) {
    return root.id === candidateId || (root.children || []).some(child => isInSubtree(child, candidateId));
  }

  function expandAncestors(nodeId) {
    let current = findNode(nodeId);
    while (current) {
      collapsedIds.delete(current.node.id);
      current = current.parent ? findNode(current.parent.id) : null;
    }
  }

  function moveNode(sourceId, targetId, position) {
    const source = findNode(sourceId);
    const target = findNode(targetId);
    if (!source?.parent || !target || isInSubtree(source.node, target.node.id)) return false;

    let destinationParent;
    let destinationIndex;
    if (position === "inside") {
      destinationParent = target.node;
      destinationIndex = destinationParent.children.length;
    } else {
      if (!target.parent) return false;
      destinationParent = target.parent;
      const targetIndex = destinationParent.children.findIndex(child => child.id === target.node.id);
      destinationIndex = targetIndex + (position === "after" ? 1 : 0);
    }

    const sourceParent = source.parent;
    const sourceIndex = sourceParent.children.findIndex(child => child.id === source.node.id);
    if (sourceParent === destinationParent && sourceIndex < destinationIndex) destinationIndex -= 1;
    if (sourceParent === destinationParent && sourceIndex === destinationIndex) return false;

    remember();
    sourceParent.children.splice(sourceIndex, 1);
    destinationIndex = Math.max(0, Math.min(destinationIndex, destinationParent.children.length));
    destinationParent.children.splice(destinationIndex, 0, source.node);
    selectedId = source.node.id;
    expandAncestors(destinationParent.id);
    commit();
    els.mapStatus.textContent = `Moved ${source.node.text}`;
    return true;
  }

  function moveSelectedWithinSiblings(direction) {
    const found = findNode(selectedId);
    if (!found?.parent) return false;
    const siblings = found.parent.children;
    const index = siblings.findIndex(child => child.id === found.node.id);
    const target = siblings[index + direction];
    if (!target) return false;
    return moveNode(found.node.id, target.id, direction < 0 ? "before" : "after");
  }

  function changeSelectedIndent(direction) {
    const found = findNode(selectedId);
    if (!found?.parent) return false;
    if (direction < 0) {
      if (found.parent === map.root) return false;
      return moveNode(found.node.id, found.parent.id, "after");
    }
    const siblings = found.parent.children;
    const index = siblings.findIndex(child => child.id === found.node.id);
    const previousSibling = siblings[index - 1];
    if (!previousSibling) return false;
    return moveNode(found.node.id, previousSibling.id, "inside");
  }

  function dropPositionFor(row, node, event) {
    if (node.id === map.root.id) return "inside";
    const rect = row.getBoundingClientRect();
    const offset = (event.clientY - rect.top) / Math.max(1, rect.height);
    if (node.id !== map.root.id && findNode(node.id)?.parent && offset < .24) return "before";
    if (node.id !== map.root.id && findNode(node.id)?.parent && offset > .76) return "after";
    return "inside";
  }

  function renderOutlineNode(node, depth = 0) {
    const branch = document.createElement("div");
    branch.className = `outline-branch outline-depth-${depth}${node.id === map.root.id ? " outline-root" : ""}`;
    const row = document.createElement("div");
    row.className = `outline-row${node.id === selectedId ? " is-selected" : ""}${node.id === map.root.id ? " is-root" : ""}`;
    row.dataset.nodeId = node.id;
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-level", String(depth + 1));
    row.setAttribute("aria-selected", String(node.id === selectedId));
    row.tabIndex = node.id === selectedId ? 0 : -1;
    const grip = document.createElement(node.id === map.root.id ? "span" : "button");
    grip.className = "outline-grip";
    if (node.id === map.root.id) grip.setAttribute("aria-hidden", "true");
    else {
      grip.type = "button";
      grip.draggable = true;
      grip.textContent = "•";
      grip.title = "Drag to move concept";
      grip.setAttribute("aria-label", `Drag ${node.text} to move it`);
      grip.addEventListener("dragstart", event => {
        draggedId = node.id;
        event.dataTransfer?.setData("text/plain", node.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        row.classList.add("is-dragging");
      });
    }
    row.appendChild(grip);

    const children = node.children || [];
    if (children.length) {
      const isExpanded = !collapsedIds.has(node.id);
      row.setAttribute("aria-expanded", String(isExpanded));
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "outline-toggle";
      toggle.tabIndex = -1;
      toggle.setAttribute("aria-label", `${isExpanded ? "Collapse" : "Expand"} ${node.text}`);
      toggle.setAttribute("aria-expanded", String(isExpanded));
      toggle.addEventListener("click", event => {
        event.stopPropagation();
        if (isExpanded) collapsedIds.add(node.id);
        else collapsedIds.delete(node.id);
        render();
        els.outlineView.querySelector(`[data-node-id="${CSS.escape(node.id)}"]`)?.focus();
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "outline-toggle-placeholder";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    const label = document.createElement("span");
    label.className = "outline-label";
    label.textContent = node.text;
    const content = document.createElement("span");
    content.className = "outline-content";
    if (node.id !== map.root.id && node.relationLabel) {
      const relation = document.createElement("span");
      relation.className = "outline-relation";
      relation.textContent = node.relationLabel;
      relation.title = "Relationship to parent concept";
      content.appendChild(relation);
    }
    content.appendChild(label);
    const noteText = notesToPlainText(node.notes);
    if (noteText) {
      const notes = document.createElement("span");
      notes.className = "outline-note";
      notes.innerHTML = safeNotesHtml(node.notes);
      content.appendChild(notes);
    }
    const ariaDescription = [node.id !== map.root.id && node.relationLabel ? `Relationship to parent: ${node.relationLabel}` : "", noteText ? `Notes: ${noteText}` : ""].filter(Boolean).join(". ");
    if (ariaDescription) row.setAttribute("aria-label", `${node.text}. ${ariaDescription}`);
    row.appendChild(content);
    row.addEventListener("click", () => selectNode(node.id));
    row.addEventListener("dblclick", event => { event.stopPropagation(); selectNode(node.id); openEditor(); });
    row.addEventListener("dragover", event => {
      if (!draggedId || !findNode(draggedId) || isInSubtree(findNode(draggedId).node, node.id)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      els.outlineView.querySelectorAll(".drop-before, .drop-after, .drop-inside").forEach(item => item.classList.remove("drop-before", "drop-after", "drop-inside"));
      const position = dropPositionFor(row, node, event);
      row.classList.add(`drop-${position}`);
    });
    row.addEventListener("dragleave", event => {
      if (!row.contains(event.relatedTarget)) row.classList.remove("drop-before", "drop-after", "drop-inside");
    });
    row.addEventListener("drop", event => {
      event.preventDefault();
      if (draggedId) moveNode(draggedId, node.id, dropPositionFor(row, node, event));
      draggedId = null;
    });
    row.addEventListener("dragend", () => {
      draggedId = null;
      els.outlineView.querySelectorAll(".is-dragging, .drop-before, .drop-after, .drop-inside").forEach(item => item.classList.remove("is-dragging", "drop-before", "drop-after", "drop-inside"));
    });
    branch.appendChild(row);

    if (children.length) {
      const group = document.createElement("div");
      group.className = "outline-children";
      group.setAttribute("role", "group");
      group.hidden = collapsedIds.has(node.id);
      children.forEach(child => group.appendChild(renderOutlineNode(child, depth + 1)));
      branch.appendChild(group);
    }
    return branch;
  }

  function renderOutline() {
    els.outlineView.replaceChildren();
    const tree = document.createElement("div");
    tree.className = "outline-tree";
    tree.appendChild(renderOutlineNode(map.root));
    els.outlineView.appendChild(tree);
  }

  function focusSelectedNode() {
    const selector = `[data-node-id="${CSS.escape(selectedId)}"]`;
    const target = activeView === "outline" ? els.outlineView.querySelector(selector) : els.mapContent.querySelector(selector);
    target?.focus();
  }

  function switchView(viewName) {
    activeView = viewName;
    const isOutline = activeView === "outline";
    els.mapShell.classList.toggle("is-outline", isOutline);
    els.mapCanvas.toggleAttribute("hidden", isOutline);
    els.outlineView.hidden = !isOutline;
    els.emptyHint.classList.toggle("hidden", isOutline || map.root.children.length > 0);
    els.mapViewButton.classList.toggle("is-active", !isOutline);
    els.outlineViewButton.classList.toggle("is-active", isOutline);
    els.mapViewButton.setAttribute("aria-pressed", String(!isOutline));
    els.outlineViewButton.setAttribute("aria-pressed", String(isOutline));
    focusSelectedNode();
  }

  function render(resetView = false) {
    const before = view ? { ...view } : null;
    layout = calculateLayout();
    els.mapContent.replaceChildren();
    for (const path of layout.paths) els.mapContent.appendChild(drawPath(path));
    for (const node of layout.nodes) els.mapContent.appendChild(renderNode(node));
    renderOutline();
    els.mapCanvas.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    if (!before || resetView) fitView();
    else view = before;
    setView();
    const selected = findNode(selectedId)?.node || map.root;
    selectedId = selected.id;
    els.addSiblingButton.disabled = selected === map.root;
    els.deleteNodeButton.disabled = selected === map.root;
    const selectedLocation = findNode(selected.id);
    const selectedSiblings = selectedLocation?.parent?.children || [];
    const selectedIndex = selectedSiblings.findIndex(child => child.id === selected.id);
    els.moveConceptUpButton.disabled = !selectedLocation?.parent || selectedIndex <= 0;
    els.moveConceptDownButton.disabled = !selectedLocation?.parent || selectedIndex >= selectedSiblings.length - 1;
    els.outdentConceptButton.disabled = !selectedLocation?.parent || selectedLocation.parent === map.root;
    els.indentConceptButton.disabled = !selectedLocation?.parent || selectedIndex <= 0;
    els.balancedLayoutButton.classList.toggle("is-active", layoutMode === "balanced");
    els.rightLayoutButton.classList.toggle("is-active", layoutMode === "right");
    els.balancedLayoutButton.setAttribute("aria-pressed", String(layoutMode === "balanced"));
    els.rightLayoutButton.setAttribute("aria-pressed", String(layoutMode === "right"));
    els.undoButton.disabled = history.length === 0;
    els.redoButton.disabled = future.length === 0;
    els.editNodeButton.disabled = false;
    els.emptyHint.classList.toggle("hidden", activeView === "outline" || map.root.children.length > 0);
    els.mapCanvas.setAttribute("aria-label", `Concept map with ${layout.nodes.length} concepts`);
  }

  function selectNode(id) {
    selectedId = id;
    render();
    focusSelectedNode();
  }

  function setLayoutMode(mode) {
    if (mode === layoutMode) return;
    layoutMode = mode;
    try { localStorage.setItem(LAYOUT_KEY, layoutMode); } catch { /* Keep the selection for this session. */ }
    render(true);
    els.mapStatus.textContent = layoutMode === "right" ? "Right-aligned layout" : "Balanced layout";
  }

  function addChild(parentId = selectedId) {
    const found = findNode(parentId);
    if (!found) return;
    collapsedIds.delete(parentId);
    remember();
    const node = { id: makeId(), text: "New concept", relationLabel: "", notes: "", children: [] };
    found.node.children.push(node);
    selectedId = node.id;
    commit();
    openEditor();
  }

  function addSibling() {
    const found = findNode(selectedId);
    if (!found?.parent) return;
    collapsedIds.delete(found.parent.id);
    remember();
    const node = { id: makeId(), text: "New concept", relationLabel: "", notes: "", children: [] };
    const index = found.parent.children.findIndex(child => child.id === selectedId);
    found.parent.children.splice(index + 1, 0, node);
    selectedId = node.id;
    commit();
    openEditor();
  }

  function editSelected() { openEditor(); }

  function openEditor() {
    const found = findNode(selectedId);
    if (!found) return;
    editingId = found.node.id;
    els.nodeTextInput.value = found.node.text;
    els.relationLabelInput.value = found.node.relationLabel || "";
    els.relationLabelField.hidden = found.node.id === map.root.id;
    els.nodeNotesInput.innerHTML = safeNotesHtml(found.node.notes || "");
    els.editDialog.showModal();
    requestAnimationFrame(() => { els.nodeTextInput.focus(); els.nodeTextInput.select(); });
  }

  function openConnectionEditor(childId) {
    const found = findNode(childId);
    if (!found?.parent) return;
    editingConnectionId = childId;
    els.connectionContext.textContent = `Describe how "${found.parent.text}" relates to "${found.node.text}".`;
    els.connectionLabelInput.value = found.node.relationLabel || "";
    els.connectionDialog.showModal();
    requestAnimationFrame(() => { els.connectionLabelInput.focus(); els.connectionLabelInput.select(); });
  }

  function closeConnectionEditor() {
    if (els.connectionDialog.open) els.connectionDialog.close();
    editingConnectionId = null;
    requestAnimationFrame(focusSelectedNode);
  }

  function saveConnectionLabel(event) {
    event.preventDefault();
    const found = editingConnectionId ? findNode(editingConnectionId) : null;
    const relationLabel = els.connectionLabelInput.value.trim();
    if (found?.parent && (found.node.relationLabel || "") !== relationLabel) {
      remember();
      found.node.relationLabel = relationLabel;
      commit();
    }
    closeConnectionEditor();
  }

  function closeEditor() {
    if (els.editDialog.open) els.editDialog.close();
    editingId = null;
    requestAnimationFrame(focusSelectedNode);
  }

  function saveEdit(event) {
    event.preventDefault();
    const text = els.nodeTextInput.value.trim();
    const relationLabel = editingId === map.root.id ? "" : els.relationLabelInput.value.trim();
    const safeNotes = safeNotesHtml(els.nodeNotesInput.innerHTML);
    const notes = notesToPlainText(safeNotes) ? safeNotes : "";
    if (!text || !editingId) return;
    const found = findNode(editingId);
    if (found && (found.node.text !== text || (found.node.relationLabel || "") !== relationLabel || safeNotesHtml(found.node.notes || "") !== notes)) {
      remember();
      found.node.text = text;
      found.node.relationLabel = relationLabel;
      found.node.notes = notes;
      if (found.node === map.root) map.title = text;
      commit();
    }
    closeEditor();
  }

  function deleteSelected() {
    const found = findNode(selectedId);
    if (!found?.parent) return;
    remember();
    const siblings = found.parent.children;
    const index = siblings.findIndex(node => node.id === selectedId);
    siblings.splice(index, 1);
    selectedId = found.parent.id;
    commit();
  }

  function undo() {
    if (!history.length) return;
    future.push(clone(map));
    map = history.pop();
    selectedId = findNode(selectedId)?.node.id || map.root.id;
    commit();
  }

  function redo() {
    if (!future.length) return;
    history.push(clone(map));
    map = future.pop();
    selectedId = findNode(selectedId)?.node.id || map.root.id;
    commit();
  }

  function download(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeFilename(value, extension) {
    const base = String(value || "concept-map").normalize("NFKD").replace(/[^\w -]/g, "").trim().replace(/[ -]+/g, "-").slice(0, 55) || "concept-map";
    return `${base}.${extension}`;
  }

  function displayFileName(name) { return String(name || "concept-map.json").replace(/\.json$/i, ""); }

  function formatSavedTime(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function setFileStatus(message, state = "") {
    els.fileSaveLabel.textContent = message;
    els.fileSaveStatus.classList.toggle("error", state === "error");
    els.fileSaveStatus.classList.toggle("saving", state === "saving");
    els.fileSaveStatus.classList.toggle("saved", state === "saved");
  }

  function setUnlinkedStatus() {
    if (fileDirty && importedFileName) setFileStatus(`Unsaved changes from ${displayFileName(importedFileName)} — use Save As to save a file`, "saving");
    else if (fileDirty) setFileStatus("Unsaved changes — use Save As to save a JSON file", "saving");
    else if (importedFileName) setFileStatus(`Loaded ${displayFileName(importedFileName)} — use Save As to save changes`);
    else setFileStatus("No file linked — use Save As or Load");
  }

  function mapSnapshot() {
    const savedAt = new Date().toISOString();
    const data = { ...clone(map), _fileMeta: { updatedAt: savedAt, revision: makeId() } };
    return { text: JSON.stringify(data, null, 2), savedAt, stateSignature: JSON.stringify(map) };
  }

  function openHandleDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("File links are unavailable in this browser."));
      const request = indexedDB.open(HANDLE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(HANDLE_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open file link storage."));
    });
  }

  async function storeFileHandle(handle) {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(HANDLE_STORE, "readwrite");
      transaction.objectStore(HANDLE_STORE).put(handle, ACTIVE_HANDLE_KEY);
      transaction.oncomplete = () => { db.close(); fileHandlePersisted = true; resolve(); };
      transaction.onerror = () => { db.close(); fileHandlePersisted = false; reject(transaction.error || new Error("Could not remember this file.")); };
    });
  }

  async function clearStoredFileHandle(force = false) {
    if (!fileHandlePersisted && !force) return;
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(HANDLE_STORE, "readwrite");
      transaction.objectStore(HANDLE_STORE).delete(ACTIVE_HANDLE_KEY);
      transaction.oncomplete = () => { db.close(); fileHandlePersisted = false; resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Could not disconnect the linked file.")); };
    });
  }

  async function getStoredFileHandle() {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction(HANDLE_STORE, "readonly").objectStore(HANDLE_STORE).get(ACTIVE_HANDLE_KEY);
      request.onsuccess = () => { const result = request.result || null; db.close(); resolve(result); };
      request.onerror = () => { db.close(); reject(request.error || new Error("Could not restore the file link.")); };
    });
  }

  async function hasWritePermission(handle, ask = false) {
    if (!handle || typeof handle.queryPermission !== "function") return false;
    let permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted" && ask && typeof handle.requestPermission === "function") permission = await handle.requestPermission({ mode: "readwrite" });
    return permission === "granted";
  }

  function markFileConflict(handle) {
    if (linkedFileHandle !== handle) return;
    fileConflict = true;
    els.mapShell.inert = true;
    els.reloadFileButton.hidden = false;
    setFileStatus(`File changed outside Concept Mapper — reload ${displayFileName(handle.name)} before saving`, "error");
  }

  async function writeMapFile(handle, snapshot, force = false) {
    if (!(await hasWritePermission(handle))) {
      if (linkedFileHandle === handle) {
        els.mapShell.inert = true;
        els.reloadFileButton.hidden = false;
        setFileStatus(`Permission needed to save ${displayFileName(handle.name)} — click Reload`, "error");
      }
      return false;
    }
    if (!force) {
      const expectedText = fileBaseSignatures.get(handle);
      if (typeof expectedText !== "string" || await (await handle.getFile()).text() !== expectedText) {
        markFileConflict(handle);
        return false;
      }
    }
    const writable = await handle.createWritable();
    await writable.write(snapshot.text);
    await writable.close();
    fileBaseSignatures.set(handle, snapshot.text);
    if (linkedFileHandle === handle) {
      fileConflict = false;
      if (JSON.stringify(map) === snapshot.stateSignature) fileDirty = false;
      els.mapShell.inert = false;
      els.reloadFileButton.hidden = false;
      setFileStatus(`Saved to ${displayFileName(handle.name)} · ${formatSavedTime(snapshot.savedAt)}${fileHandlePersisted ? "" : " · Load it again next time"}`, "saved");
    }
    return true;
  }

  function queueMapFileSave(handle, snapshot, generation = stateGeneration, force = false) {
    if (!handle || (fileConflict && !force)) return fileWriteQueue;
    if (linkedFileHandle === handle) setFileStatus(`Saving to ${displayFileName(handle.name)}…`, "saving");
    fileWriteQueue = fileWriteQueue.catch(() => {}).then(async () => {
      try {
        const didSave = await writeMapFile(handle, snapshot, force);
        if (didSave && linkedFileHandle === handle && generation === stateGeneration) fileDirty = false;
      } catch (error) {
        if (linkedFileHandle === handle) {
          els.mapShell.inert = true;
          els.reloadFileButton.hidden = false;
          setFileStatus(`Could not save ${displayFileName(handle.name)}: ${error.message || "file error"}`, "error");
        }
      }
    });
    return fileWriteQueue;
  }

  function markMapEdited() {
    fileDirty = true;
    stateGeneration += 1;
    window.clearTimeout(fileSaveTimer);
    if (fileConflict) {
      setFileStatus("File changed outside Concept Mapper — reload before saving", "error");
      return;
    }
    if (!linkedFileHandle) { setUnlinkedStatus(); return; }
    const handle = linkedFileHandle;
    const generation = stateGeneration;
    setFileStatus(`Unsaved changes — saving to ${displayFileName(handle.name)}…`, "saving");
    fileSaveTimer = window.setTimeout(() => queueMapFileSave(handle, mapSnapshot(), generation), 180);
  }

  async function attachFileHandle(handle, permissionGranted = null) {
    linkedFileHandle = handle;
    try { await storeFileHandle(handle); }
    catch {
      fileHandlePersisted = false;
      try { await clearStoredFileHandle(true); } catch { /* The current session can still use this link. */ }
    }
    const canWrite = permissionGranted === true || (permissionGranted !== false && await hasWritePermission(handle, true));
    els.reloadFileButton.hidden = false;
    if (!canWrite) {
      els.mapShell.inert = true;
      setFileStatus(`Permission needed to save ${displayFileName(handle.name)} — click Reload to reconnect`, "error");
      return false;
    }
    els.mapShell.inert = false;
    fileConflict = false;
    importedFileName = null;
    return true;
  }

  function suggestedMapFilename() {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
    return `Concept_Map_${date}_${time}.json`;
  }

  function downloadMap() {
    const snapshot = mapSnapshot();
    const filename = suggestedMapFilename();
    download(filename, snapshot.text, "application/json");
    fileDirty = false;
    setFileStatus(`Downloaded ${displayFileName(filename)} · download again after further edits`, "saved");
  }

  async function saveMap() {
    if (!fileRestoreComplete) return;
    if (typeof window.showSaveFilePicker !== "function") { downloadMap(); return; }
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: suggestedMapFilename(),
        types: [{ description: "Concept Mapper JSON", accept: { "application/json": [".json"] } }],
      });
      if (!await attachFileHandle(handle)) return;
      fileDirty = true;
      await queueMapFileSave(handle, mapSnapshot(), stateGeneration, true);
      if (!fileDirty) setFileStatus(`Saved to ${displayFileName(handle.name)} · ${formatSavedTime(new Date().toISOString())}`, "saved");
    } catch (error) {
      if (error.name !== "AbortError") setFileStatus(`Save failed: ${error.message || "file error"}`, "error");
    }
  }

  function xmlEscape(value) {
    return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function wordInlineRuns(nodes, format = {}) {
    return [...nodes].map(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.nodeValue ? `<w:r>${format.bold || format.italic || format.script ? `<w:rPr>${format.bold ? "<w:b/>" : ""}${format.italic ? "<w:i/>" : ""}${format.script ? `<w:vertAlign w:val="${format.script}"/>` : ""}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEscape(node.nodeValue)}</w:t></w:r>` : "";
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      if (node.tagName === "BR") return "<w:r><w:br/></w:r>";
      if (["UL", "OL", "LI", "P", "DIV"].includes(node.tagName)) return wordInlineRuns([...node.childNodes].filter(child => !["UL", "OL", "LI"].includes(child.tagName)), format);
      const next = { ...format };
      if (["B", "STRONG"].includes(node.tagName)) next.bold = true;
      if (["I", "EM"].includes(node.tagName)) next.italic = true;
      if (node.tagName === "SUP") next.script = "superscript";
      if (node.tagName === "SUB") next.script = "subscript";
      return wordInlineRuns([...node.childNodes], next);
    }).join("");
  }

  function updateScriptToolbarState() {
    const selection = window.getSelection();
    const withinNotes = selection?.rangeCount && els.nodeNotesInput.contains(selection.anchorNode) && els.nodeNotesInput.contains(selection.focusNode);
    ["superscript", "subscript"].forEach(command => {
      const button = els.nodeNotesInput.parentElement.querySelector(`[data-note-command="${command}"]`);
      const active = Boolean(withinNotes && document.queryCommandState(command));
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("is-active", active);
    });
  }

  function clearScriptFormatting() {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!els.nodeNotesInput.contains(range.startContainer) || !els.nodeNotesInput.contains(range.endContainer)) return;
    if (document.queryCommandState("superscript")) document.execCommand("superscript", false, null);
    if (document.queryCommandState("subscript")) document.execCommand("subscript", false, null);
  }

  function wordNoteParagraph(runs, bulleted = false) {
    const indent = bulleted ? '<w:ind w:left="720" w:hanging="360"/>' : '<w:ind w:left="360"/>';
    return `<w:p><w:pPr><w:pStyle w:val="Normal"/>${indent}<w:spacing w:after="120"/></w:pPr>${runs}</w:p>`;
  }

  function wordNoteParagraphs(value) {
    const parsed = document.createElement("div");
    parsed.innerHTML = safeNotesHtml(value);
    const paragraphs = [];
    const emitList = list => {
      [...list.children].filter(item => item.tagName === "LI").forEach((item, index) => {
        const inline = [...item.childNodes].filter(child => child.nodeType !== Node.ELEMENT_NODE || !["UL", "OL"].includes(child.tagName));
        const marker = list.tagName === "OL" ? `${index + 1}. ` : "• ";
        const runs = `<w:r><w:t xml:space="preserve">${xmlEscape(marker)}</w:t></w:r>${wordInlineRuns(inline)}`;
        paragraphs.push(wordNoteParagraph(runs, true));
        [...item.children].filter(child => ["UL", "OL"].includes(child.tagName)).forEach(emitList);
      });
    };
    const emitBlocks = container => {
      let inline = [];
      const flush = () => {
        if (!inline.length) return;
        const runs = wordInlineRuns(inline);
        if (runs) paragraphs.push(wordNoteParagraph(runs));
        inline = [];
      };
      [...container.childNodes].forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes(child.tagName)) {
          flush();
          emitList(child);
        } else if (child.nodeType === Node.ELEMENT_NODE && ["P", "DIV"].includes(child.tagName)) {
          flush();
          const nestedLists = [...child.children].filter(item => ["UL", "OL"].includes(item.tagName));
          const content = [...child.childNodes].filter(item => !(item.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes(item.tagName)));
          const runs = wordInlineRuns(content);
          if (runs) paragraphs.push(wordNoteParagraph(runs));
          nestedLists.forEach(emitList);
        } else inline.push(child);
      });
      flush();
    };
    emitBlocks(parsed);
    return paragraphs.join("");
  }

  function wordParagraph(node, depth) {
    const level = Math.min(depth + 1, 9);
    const textRuns = String(node.text || "").split("\n").map((line, index) => `${index ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r>`).join("");
    const heading = `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr>${textRuns}</w:p>`;
    const relation = node.relationLabel ? `<w:p><w:pPr><w:pStyle w:val="Normal"/><w:ind w:left="360"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${xmlEscape(node.relationLabel)}</w:t></w:r></w:p>` : "";
    return `${relation}${heading}${notesToPlainText(node.notes) ? wordNoteParagraphs(node.notes) : ""}`;
  }

  function wordDocumentXml() {
    const paragraphs = [];
    const visit = (node, depth) => {
      paragraphs.push(wordParagraph(node, depth));
      (node.children || []).forEach(child => visit(child, depth + 1));
    };
    visit(map.root, 0);
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      paragraphs.join("") +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
      '</w:body></w:document>';
  }

  function wordStylesXml() {
    const sizes = [32, 26, 24, 22, 20, 20, 20, 20, 20];
    const headings = sizes.map((size, index) => {
      const level = index + 1;
      const before = Math.max(80, 240 - index * 24);
      const color = level === 1 ? '<w:color w:val="2E74B5" w:themeColor="accent1" w:themeShade="BF"/>' : '<w:color w:val="2E74B5" w:themeColor="accent1"/>';
      return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="${level + 8}"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${before}" w:after="0" w:line="259" w:lineRule="auto"/><w:outlineLvl w:val="${index}"/></w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi" w:eastAsiaTheme="majorEastAsia" w:hAnsiTheme="majorHAnsi" w:cstheme="majorBidi"/>${color}<w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
    }).join("");
    const normal = '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${normal}${headings}</w:styles>`;
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipStore(entries) {
    const encoder = new TextEncoder();
    const locals = [];
    const centrals = [];
    let localOffset = 0;
    let centralSize = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const write = (bytes, signature, fields) => {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      view.setUint32(0, signature, true);
      for (const [position, value, size] of fields) {
        if (size === 2) view.setUint16(position, value, true);
        else view.setUint32(position, value, true);
      }
    };

    for (const [name, content] of entries) {
      const filename = encoder.encode(name);
      const data = encoder.encode(content);
      const crc = crc32(data);
      const local = new Uint8Array(30 + filename.length + data.length);
      write(local, 0x04034B50, [[4,20,2],[6,0x0800,2],[8,0,2],[10,dosTime,2],[12,dosDate,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,filename.length,2],[28,0,2]]);
      local.set(filename, 30);
      local.set(data, 30 + filename.length);
      locals.push(local);

      const central = new Uint8Array(46 + filename.length);
      write(central, 0x02014B50, [[4,20,2],[6,20,2],[8,0x0800,2],[10,0,2],[12,dosTime,2],[14,dosDate,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,filename.length,2],[30,0,2],[32,0,2],[34,0,2],[36,0,2],[38,0,4],[42,localOffset,4]]);
      central.set(filename, 46);
      centrals.push(central);
      localOffset += local.length;
      centralSize += central.length;
    }

    const end = new Uint8Array(22);
    write(end, 0x06054B50, [[4,0,2],[6,0,2],[8,entries.length,2],[10,entries.length,2],[12,centralSize,4],[16,localOffset,4],[20,0,2]]);
    const parts = [...locals, ...centrals, end];
    const archive = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
    let offset = 0;
    for (const part of parts) { archive.set(part, offset); offset += part.length; }
    return archive;
  }

  function exportWord() {
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>';
    const packageRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    const documentRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>';
    const settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>';
    const entries = [
      ["[Content_Types].xml", contentTypes],
      ["_rels/.rels", packageRels],
      ["word/document.xml", wordDocumentXml()],
      ["word/styles.xml", wordStylesXml()],
      ["word/settings.xml", settings],
      ["word/_rels/document.xml.rels", documentRels]
    ];
    download(safeFilename(map.root.text, "docx"), zipStore(entries), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    els.mapStatus.textContent = "Map exported as a Word document";
  }

  function exportSvg() {
    const cloneSvg = els.mapCanvas.cloneNode(true);
    cloneSvg.setAttribute("xmlns", SVG_NS);
    cloneSvg.setAttribute("width", String(Math.round(layout.width)));
    cloneSvg.setAttribute("height", String(Math.round(layout.height)));
    cloneSvg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    const background = svgEl("rect", { x: 0, y: 0, width: layout.width, height: layout.height, fill: "#ffffff" });
    cloneSvg.insertBefore(background, cloneSvg.firstChild);
    cloneSvg.querySelectorAll(".node-hit, .node-add-dot, .node-add-plus, .connector-hit").forEach(item => item.remove());
    cloneSvg.querySelectorAll(".node-group.selected").forEach(item => item.classList.remove("selected"));
    const style = svgEl("style");
    style.textContent = `.node-branch{fill:none;stroke:#68766f;stroke-width:1.45;stroke-linecap:round}.node-branch.root-branch{stroke-width:2.4;stroke:#52615a}.connection-label-back{fill:#fff;fill-opacity:.96;stroke:#dfe7df;stroke-width:1}.connection-label{fill:#53645a;font-family:'DM Sans','Segoe UI',sans-serif;font-size:10px;font-weight:600;text-anchor:middle;dominant-baseline:central}.node-label{fill:#38463f;font-family:'DM Sans','Segoe UI',sans-serif;font-size:12px;dominant-baseline:central}.node-label.main-topic{font-size:13px;font-weight:700}.node-label.root-label{font-family:Manrope,'Segoe UI',sans-serif;font-size:16px;font-weight:800;fill:#183c2a}`;
    cloneSvg.insertBefore(style, cloneSvg.children[1] || null);
    const serialized = new XMLSerializer().serializeToString(cloneSvg);
    download(safeFilename(map.root.text, "svg"), `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`, "image/svg+xml;charset=utf-8");
    els.mapStatus.textContent = "Map exported as an SVG image";
  }

  function parseMapFile(raw) {
    const value = JSON.parse(raw);
    if (!validMap(value)) throw new Error("This file is not a Concept Mapper map.");
    const loaded = clone(value);
    delete loaded._fileMeta;
    return loaded;
  }

  function fileSavedAt(raw, file) {
    try {
      const metadata = JSON.parse(raw)._fileMeta;
      if (typeof metadata?.updatedAt === "string") return metadata.updatedAt;
    } catch { /* Files saved before metadata was added use the file modification time. */ }
    return file?.lastModified ? new Date(file.lastModified).toISOString() : "";
  }

  async function loadSelectedFile(handle, permissionGranted = null) {
    try {
      const file = await handle.getFile();
      const raw = await file.text();
      const loadedMap = parseMapFile(raw);
      const canWrite = await attachFileHandle(handle, permissionGranted);
      window.clearTimeout(fileSaveTimer);
      map = loadedMap;
      selectedId = map.root.id;
      collapsedIds.clear();
      history = [];
      future = [];
      fileBaseSignatures.set(handle, raw);
      fileConflict = false;
      fileDirty = false;
      importedFileName = null;
      suspendFileTracking = true;
      saveLocal();
      render(true);
      suspendFileTracking = false;
      if (canWrite) {
        els.mapShell.inert = false;
        const savedTime = formatSavedTime(fileSavedAt(raw, file));
        setFileStatus(savedTime ? `Loaded ${displayFileName(handle.name)} · last saved ${savedTime}` : `Loaded ${displayFileName(handle.name)} · ready to save`);
      }
    } catch (error) {
      suspendFileTracking = false;
      setFileStatus(`Could not read ${displayFileName(handle.name)}: ${error.message || "invalid map JSON"}`, "error");
    }
  }

  async function openMapFile(file) {
    if (!file) return;
    try {
      const loadedMap = parseMapFile(await file.text());
      await clearStoredFileHandle();
      window.clearTimeout(fileSaveTimer);
      linkedFileHandle = null;
      fileBaseSignatures = new WeakMap();
      fileConflict = false;
      fileDirty = false;
      importedFileName = file.name;
      els.reloadFileButton.hidden = true;
      els.mapShell.inert = false;
      map = loadedMap;
      selectedId = map.root.id;
      collapsedIds.clear();
      history = [];
      future = [];
      saveLocal();
      render(true);
      setUnlinkedStatus();
    } catch (error) {
      els.mapStatus.textContent = "That file could not be opened as a Concept Mapper map";
      setFileStatus(`Could not load file: ${error.message || "invalid map JSON"}`, "error");
    } finally {
      els.openFileInput.value = "";
    }
  }

  async function loadMap() {
    if (!fileRestoreComplete) return;
    if (fileDirty && !window.confirm("Load another map and discard the current unsaved changes? Use Save As first if you want to keep them.")) return;
    if (typeof window.showOpenFilePicker === "function") {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: "Concept Mapper JSON", accept: { "application/json": [".json"] } }],
        });
        let permissionGranted = false;
        try { permissionGranted = await hasWritePermission(handle, true); } catch { /* Open read-only until write permission is restored. */ }
        await loadSelectedFile(handle, permissionGranted);
      } catch (error) {
        if (error.name !== "AbortError") setFileStatus(`Load failed: ${error.message || "file error"}`, "error");
      }
      return;
    }
    els.openFileInput.click();
  }

  async function reloadLinkedFile() {
    if (!fileRestoreComplete) return;
    const handle = linkedFileHandle;
    if (!handle) return loadMap();
    if (fileDirty && !window.confirm("Reload the latest file and discard unsaved changes on this page? Use Save As first if you want to keep a copy.")) return;
    try {
      window.clearTimeout(fileSaveTimer);
      const permissionGranted = await hasWritePermission(handle, true);
      await loadSelectedFile(handle, permissionGranted);
    } catch (error) {
      els.mapShell.inert = true;
      setFileStatus(`Could not reconnect ${displayFileName(handle.name)}: ${error.message || "permission needed"}`, "error");
    }
  }

  async function restoreFileLink() {
    els.mapShell.inert = true;
    setFileStatus("Checking for a linked map file…");
    try {
      const handle = await getStoredFileHandle();
      if (!handle) {
        els.mapShell.inert = false;
        els.reloadFileButton.hidden = true;
        setUnlinkedStatus();
        return;
      }
      linkedFileHandle = handle;
      fileHandlePersisted = true;
      els.reloadFileButton.hidden = false;
      if (await hasWritePermission(handle)) {
        await loadSelectedFile(handle, true);
        return;
      }
      setFileStatus(`Click Reload to open the latest ${displayFileName(handle.name)} before editing`, "error");
    } catch (error) {
      if (linkedFileHandle) {
        els.mapShell.inert = true;
        els.reloadFileButton.hidden = false;
        setFileStatus(`Click Reload to reconnect ${displayFileName(linkedFileHandle.name)} before editing`, "error");
      } else {
        els.mapShell.inert = false;
        els.reloadFileButton.hidden = true;
        setUnlinkedStatus();
      }
    } finally {
      fileRestoreComplete = true;
      els.undoButton.disabled = history.length === 0 || fileConflict || els.mapShell.inert;
      els.redoButton.disabled = future.length === 0 || fileConflict || els.mapShell.inert;
    }
  }

  async function newMap() {
    if (!fileRestoreComplete) return;
    if (!window.confirm("Start a new blank map? Unsaved changes will be saved to a linked file when possible, then that file will be disconnected. Use Save As first if you want a separate copy.")) return;
    window.clearTimeout(fileSaveTimer);
    if (linkedFileHandle && fileDirty && !fileConflict) queueMapFileSave(linkedFileHandle, mapSnapshot(), stateGeneration);
    await fileWriteQueue;
    try { await clearStoredFileHandle(); }
    catch (error) {
      window.alert("The linked file could not be disconnected, so New was cancelled to protect it.");
      return;
    }
    linkedFileHandle = null;
    fileHandlePersisted = false;
    fileBaseSignatures = new WeakMap();
    fileConflict = false;
    fileDirty = false;
    importedFileName = null;
    els.reloadFileButton.hidden = true;
    els.mapShell.inert = false;
    map = freshMap();
    selectedId = map.root.id;
    collapsedIds.clear();
    history = [];
    future = [];
    saveLocal();
    render(true);
    setFileStatus("New blank map — use Save As to create its file");
  }

  function handleKeys(event) {
    if (els.connectionDialog.open) {
      if (event.key === "Escape") { event.preventDefault(); closeConnectionEditor(); }
      if (event.key === "Enter" && event.target === els.connectionLabelInput) { event.preventDefault(); els.connectionForm.requestSubmit(); }
      return;
    }
    if (els.editDialog.open) {
      if (event.key === "Escape") closeEditor();
      if (event.key === "Enter" && !event.shiftKey && event.target === els.nodeTextInput) { event.preventDefault(); els.editForm.requestSubmit(); }
      return;
    }
    const tag = event.target?.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || event.target?.isContentEditable) return;
    const outlineRow = event.target.closest?.(".outline-row");
    if (activeView === "outline" && outlineRow) {
      const visibleRows = [...els.outlineView.querySelectorAll(".outline-row")].filter(row => row.getClientRects().length);
      const index = visibleRows.indexOf(outlineRow);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const next = visibleRows[index + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) { event.preventDefault(); selectNode(next.dataset.nodeId); focusSelectedNode(); }
        return;
      }
      if (event.key === "ArrowRight") {
        const node = findNode(selectedId)?.node;
        if (node?.children.length) {
          event.preventDefault();
          if (collapsedIds.has(node.id)) { collapsedIds.delete(node.id); render(); focusSelectedNode(); }
          else { selectNode(node.children[0].id); focusSelectedNode(); }
        }
        return;
      }
      if (event.key === "ArrowLeft") {
        const found = findNode(selectedId);
        if (found?.node.children.length && !collapsedIds.has(selectedId)) {
          event.preventDefault(); collapsedIds.add(selectedId); render(); focusSelectedNode();
        } else if (found?.parent) {
          event.preventDefault(); selectNode(found.parent.id); focusSelectedNode();
        }
        return;
      }
    }
    const inCanvas = event.target === els.mapCanvas || event.target.closest?.(".node-group, .outline-row");
    if (!inCanvas) return;
    if (event.key === "Tab") { event.preventDefault(); addChild(); }
    else if (event.key === "Enter") { event.preventDefault(); findNode(selectedId)?.parent ? addSibling() : addChild(); }
    else if (event.key === "F2") { event.preventDefault(); editSelected(); }
    else if (event.key === "Delete" || event.key === "Backspace") { if (findNode(selectedId)?.parent) { event.preventDefault(); deleteSelected(); } }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); saveMap(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && event.shiftKey) { event.preventDefault(); redo(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); undo(); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
    else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(.85); }
    else if (event.key === "-") { event.preventDefault(); zoom(1.18); }
  }

  function startPan(event) {
    if (event.button !== 0 || event.target.closest?.(".node-group, .connector-group")) return;
    pan = { x: event.clientX, y: event.clientY, view: { ...view } };
    els.mapCanvas.classList.add("is-panning");
    els.mapCanvas.setPointerCapture?.(event.pointerId);
  }
  function movePan(event) {
    if (!pan || !view) return;
    const rect = els.canvasWrap.getBoundingClientRect();
    view = { ...pan.view, x: pan.view.x - (event.clientX - pan.x) * (pan.view.width / rect.width), y: pan.view.y - (event.clientY - pan.y) * (pan.view.height / rect.height) };
    setView();
  }
  function endPan() { pan = null; els.mapCanvas.classList.remove("is-panning"); }

  els.addChildButton.addEventListener("click", () => addChild());
  els.addSiblingButton.addEventListener("click", addSibling);
  els.editNodeButton.addEventListener("click", editSelected);
  els.deleteNodeButton.addEventListener("click", deleteSelected);
  els.moveConceptUpButton.addEventListener("click", () => moveSelectedWithinSiblings(-1));
  els.moveConceptDownButton.addEventListener("click", () => moveSelectedWithinSiblings(1));
  els.outdentConceptButton.addEventListener("click", () => changeSelectedIndent(-1));
  els.indentConceptButton.addEventListener("click", () => changeSelectedIndent(1));
  els.balancedLayoutButton.addEventListener("click", () => setLayoutMode("balanced"));
  els.rightLayoutButton.addEventListener("click", () => setLayoutMode("right"));
  els.emptyAddButton.addEventListener("click", () => addChild(map.root.id));
  els.newMapButton.addEventListener("click", newMap);
  els.openMapButton.addEventListener("click", loadMap);
  els.openFileInput.addEventListener("change", event => openMapFile(event.target.files?.[0]));
  els.saveMapButton.addEventListener("click", saveMap);
  els.reloadFileButton.addEventListener("click", reloadLinkedFile);
  els.exportButton.addEventListener("click", exportSvg);
  els.exportWordButton.addEventListener("click", exportWord);
  els.zoomInButton.addEventListener("click", () => zoom(.82));
  els.zoomOutButton.addEventListener("click", () => zoom(1.22));
  els.undoButton.addEventListener("click", undo);
  els.redoButton.addEventListener("click", redo);
  els.fitButton.addEventListener("click", fitView);
  els.mapViewButton.addEventListener("click", () => switchView("map"));
  els.outlineViewButton.addEventListener("click", () => switchView("outline"));
  els.editForm.addEventListener("submit", saveEdit);
  els.connectionForm.addEventListener("submit", saveConnectionLabel);
  document.querySelectorAll("[data-note-command]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => {
      els.nodeNotesInput.focus();
      if (button.dataset.noteCommand === "normalScript") clearScriptFormatting();
      else document.execCommand(button.dataset.noteCommand, false, null);
      window.requestAnimationFrame(updateScriptToolbarState);
    });
  });
  document.querySelectorAll("[data-note-insert]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => {
      els.nodeNotesInput.focus();
      document.execCommand("insertText", false, button.dataset.noteInsert);
      window.requestAnimationFrame(updateScriptToolbarState);
    });
  });
  document.addEventListener("selectionchange", updateScriptToolbarState);
  els.cancelEditButton.addEventListener("click", closeEditor);
  els.closeDialogButton.addEventListener("click", closeEditor);
  els.editDialog.addEventListener("click", event => { if (event.target === els.editDialog) closeEditor(); });
  els.cancelConnectionButton.addEventListener("click", closeConnectionEditor);
  els.closeConnectionButton.addEventListener("click", closeConnectionEditor);
  els.connectionDialog.addEventListener("click", event => { if (event.target === els.connectionDialog) closeConnectionEditor(); });
  document.addEventListener("keydown", handleKeys);
  els.mapCanvas.addEventListener("pointerdown", startPan);
  els.mapCanvas.addEventListener("pointermove", movePan);
  els.mapCanvas.addEventListener("pointerup", endPan);
  els.mapCanvas.addEventListener("pointercancel", endPan);
  els.mapCanvas.addEventListener("wheel", event => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoom(event.deltaY < 0 ? .9 : 1.1);
  }, { passive: false });
  window.addEventListener("beforeunload", event => {
    if (!fileDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.addEventListener("resize", () => { if (layout) fitView(); });

  try {
    layoutMode = localStorage.getItem(LAYOUT_KEY) === "right" ? "right" : "balanced";
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (validMap(stored)) map = stored;
  } catch { /* Start with a fresh map if browser storage is unavailable or invalid. */ }
  selectedId = map.root.id;
  render(true);
  restoreFileLink();
})();
