const GROUP_ORDER = [
  "Structure",
  "Variables",
  "Input / Output",
  "Selection",
  "Iteration",
  "Functions"
];

const LOCAL_STORAGE_KEY = "pseudocode-builder-autosave-v1";

const BLOCK_TYPES = [
  {
    id: "program",
    category: "Structure",
    label: "Program",
    description: "Wrap the whole algorithm in a named program block.",
    fields: [
      { key: "name", label: "Program name", default: "MainRoutine" }
    ],
    sections: [
      { kind: "line", text: (values) => `PROGRAM ${values.name}` },
      {
        kind: "zone",
        key: "body",
        label: "Program steps",
        hint: "Drop the main sequence of statements here."
      },
      { kind: "line", text: () => "ENDPROGRAM" }
    ]
  },
  {
    id: "step",
    category: "Structure",
    label: "Statement",
    description: "Add a plain English action line.",
    fields: [
      { key: "text", label: "Statement", default: "Process the data" }
    ],
    line: (values) => values.text
  },
  {
    id: "comment",
    category: "Structure",
    label: "Comment",
    description: "Add a note or explanation to the algorithm.",
    fields: [
      { key: "text", label: "Comment", default: "Explain what happens here" }
    ],
    line: (values) => `// ${values.text}`
  },
  {
    id: "declare",
    category: "Variables",
    label: "Declare variable",
    description: "Introduce a named variable and data type.",
    fields: [
      { key: "name", label: "Variable name", default: "score" },
      {
        key: "dataType",
        label: "Data type",
        default: "INTEGER",
        inputType: "select",
        options: [
          "INTEGER",
          "REAL",
          "STRING",
          "BOOLEAN",
          "CHARACTER",
          "DATE",
          "ARRAY",
          "RECORD"
        ]
      }
    ],
    line: (values) => `DECLARE ${values.name} AS ${values.dataType}`
  },
  {
    id: "set",
    category: "Variables",
    label: "Set variable",
    description: "Assign or update a value.",
    fields: [
      { key: "name", label: "Variable name", default: "score" },
      { key: "expression", label: "Value or expression", default: "0" }
    ],
    line: (values) => `SET ${values.name} = ${values.expression}`
  },
  {
    id: "input",
    category: "Input / Output",
    label: "Input",
    description: "Read input into a variable.",
    fields: [
      { key: "name", label: "Variable name", default: "userChoice" }
    ],
    line: (values) => `INPUT ${values.name}`
  },
  {
    id: "output",
    category: "Input / Output",
    label: "Output",
    description: "Display text, a variable, or an expression.",
    fields: [
      { key: "value", label: "Output value", default: "\"Ready\"" }
    ],
    line: (values) => `OUTPUT ${values.value}`
  },
  {
    id: "if",
    category: "Selection",
    label: "IF",
    description: "Run steps only when a condition is true.",
    fields: [
      { key: "condition", label: "Condition", default: "score >= 50" }
    ],
    sections: [
      { kind: "line", text: (values) => `IF ${values.condition} THEN` },
      {
        kind: "zone",
        key: "thenBranch",
        label: "True branch",
        hint: "Drop steps that run when the condition is true."
      },
      { kind: "line", text: () => "ENDIF" }
    ]
  },
  {
    id: "ifElse",
    category: "Selection",
    label: "IF / ELSE",
    description: "Provide separate true and false branches.",
    fields: [
      { key: "condition", label: "Condition", default: "score >= 50" }
    ],
    sections: [
      { kind: "line", text: (values) => `IF ${values.condition} THEN` },
      {
        kind: "zone",
        key: "thenBranch",
        label: "True branch",
        hint: "Drop steps that run when the condition is true."
      },
      { kind: "line", text: () => "ELSE" },
      {
        kind: "zone",
        key: "elseBranch",
        label: "False branch",
        hint: "Drop steps that run when the condition is false."
      },
      { kind: "line", text: () => "ENDIF" }
    ]
  },
  {
    id: "while",
    category: "Iteration",
    label: "WHILE",
    description: "Repeat while a condition remains true.",
    fields: [
      { key: "condition", label: "Condition", default: "itemCount < 10" }
    ],
    sections: [
      { kind: "line", text: (values) => `WHILE ${values.condition}` },
      {
        kind: "zone",
        key: "body",
        label: "Loop body",
        hint: "Drop the repeated steps here."
      },
      { kind: "line", text: () => "ENDWHILE" }
    ]
  },
  {
    id: "for",
    category: "Iteration",
    label: "FOR",
    description: "Count through a range using a loop variable.",
    fields: [
      { key: "counter", label: "Counter", default: "index" },
      { key: "start", label: "Start value", default: "1" },
      { key: "end", label: "End value", default: "10" },
      { key: "step", label: "Step", default: "1" }
    ],
    sections: [
      {
        kind: "line",
        text: (values) => {
          const stepPart = values.step && values.step !== "1" ? ` STEP ${values.step}` : "";
          return `FOR ${values.counter} = ${values.start} TO ${values.end}${stepPart}`;
        }
      },
      {
        kind: "zone",
        key: "body",
        label: "Loop body",
        hint: "Drop the repeated steps here."
      },
      { kind: "line", text: () => "NEXT" }
    ]
  },
  {
    id: "repeatUntil",
    category: "Iteration",
    label: "REPEAT UNTIL",
    description: "Repeat a sequence until a condition becomes true.",
    fields: [
      { key: "condition", label: "Exit condition", default: "userChoice = \"quit\"" }
    ],
    sections: [
      { kind: "line", text: () => "REPEAT" },
      {
        kind: "zone",
        key: "body",
        label: "Loop body",
        hint: "Drop the repeated steps here."
      },
      { kind: "line", text: (values) => `UNTIL ${values.condition}` }
    ]
  },
  {
    id: "function",
    category: "Functions",
    label: "Function",
    description: "Create a reusable function with a return value.",
    fields: [
      { key: "name", label: "Function name", default: "calculateAverage" },
      { key: "parameters", label: "Parameters", default: "total, count" }
    ],
    sections: [
      { kind: "line", text: (values) => `FUNCTION ${values.name}(${values.parameters})` },
      {
        kind: "zone",
        key: "body",
        label: "Function body",
        hint: "Drop the function steps here."
      },
      { kind: "line", text: () => "ENDFUNCTION" }
    ]
  },
  {
    id: "procedure",
    category: "Functions",
    label: "Procedure",
    description: "Create a reusable procedure without a returned value.",
    fields: [
      { key: "name", label: "Procedure name", default: "displayMenu" },
      { key: "parameters", label: "Parameters", default: "" }
    ],
    sections: [
      { kind: "line", text: (values) => `PROCEDURE ${values.name}(${values.parameters})` },
      {
        kind: "zone",
        key: "body",
        label: "Procedure body",
        hint: "Drop the procedure steps here."
      },
      { kind: "line", text: () => "ENDPROCEDURE" }
    ]
  },
  {
    id: "call",
    category: "Functions",
    label: "Call procedure",
    description: "Call an existing function or procedure.",
    fields: [
      { key: "name", label: "Routine name", default: "displayMenu" },
      { key: "arguments", label: "Arguments", default: "" }
    ],
    line: (values) => `CALL ${values.name}(${values.arguments})`
  },
  {
    id: "return",
    category: "Functions",
    label: "Return",
    description: "Send a value back from a function.",
    fields: [
      { key: "value", label: "Return value", default: "average" }
    ],
    line: (values) => `RETURN ${values.value}`
  }
];

const appState = {
  blocks: [],
  expandedGroups: new Set(),
  dragData: null,
  editingBlockId: null
};

const dom = {
  libraryGroups: document.querySelector("#libraryGroups"),
  canvasRoot: document.querySelector("#canvasRoot"),
  outputPreview: document.querySelector("#outputPreview"),
  workspaceSummary: document.querySelector("#workspaceSummary"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  loadProjectBtn: document.querySelector("#loadProjectBtn"),
  loadProjectInput: document.querySelector("#loadProjectInput"),
  saveStatus: document.querySelector("#saveStatus"),
  copyOutputBtn: document.querySelector("#copyOutputBtn"),
  clearCanvasBtn: document.querySelector("#clearCanvasBtn"),
  editorBackdrop: document.querySelector("#editorBackdrop"),
  editorTitle: document.querySelector("#editorTitle"),
  editorForm: document.querySelector("#editorForm"),
  editorFields: document.querySelector("#editorFields"),
  closeEditorBtn: document.querySelector("#closeEditorBtn"),
  cancelEditorBtn: document.querySelector("#cancelEditorBtn")
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getType(typeId) {
  return BLOCK_TYPES.find((type) => type.id === typeId);
}

function updateSaveStatus(message) {
  dom.saveStatus.textContent = message;
}

function getZoneKeys(type) {
  if (!type.sections) {
    return [];
  }

  return type.sections
    .filter((section) => section.kind === "zone")
    .map((section) => section.key);
}

function createBlock(typeId) {
  const type = getType(typeId);
  const values = {};
  for (const field of type.fields) {
    values[field.key] = field.default || "";
  }

  const zones = {};
  for (const key of getZoneKeys(type)) {
    zones[key] = [];
  }

  return {
    id: `block-${crypto.randomUUID()}`,
    typeId,
    values,
    zones
  };
}

function sanitizeFieldValue(field, rawValue) {
  const value = typeof rawValue === "string" ? rawValue : field.default || "";
  if (field.inputType === "select" && Array.isArray(field.options) && field.options.length > 0) {
    return field.options.includes(value) ? value : field.options[0];
  }

  return value;
}

function sanitizeBlock(rawBlock) {
  if (!rawBlock || typeof rawBlock !== "object") {
    return null;
  }

  const type = getType(rawBlock.typeId);
  if (!type) {
    return null;
  }

  const values = {};
  for (const field of type.fields) {
    values[field.key] = sanitizeFieldValue(field, rawBlock.values ? rawBlock.values[field.key] : undefined);
  }

  const zones = {};
  for (const key of getZoneKeys(type)) {
    const rawZone = Array.isArray(rawBlock.zones && rawBlock.zones[key]) ? rawBlock.zones[key] : [];
    zones[key] = rawZone.map((child) => sanitizeBlock(child)).filter(Boolean);
  }

  return {
    id: typeof rawBlock.id === "string" && rawBlock.id ? rawBlock.id : `block-${crypto.randomUUID()}`,
    typeId: type.id,
    values,
    zones
  };
}

function exportState() {
  return {
    version: 1,
    blocks: appState.blocks,
    expandedGroups: [...appState.expandedGroups]
  };
}

function findFirstBlockByTypeId(typeId, blocks = appState.blocks) {
  for (const block of blocks) {
    if (block.typeId === typeId) {
      return block;
    }

    const type = getType(block.typeId);
    for (const section of type.sections || []) {
      if (section.kind !== "zone") {
        continue;
      }

      const match = findFirstBlockByTypeId(typeId, block.zones[section.key]);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

function buildProjectFileName() {
  const programBlock = findFirstBlockByTypeId("program");
  const rawName = programBlock ? String(programBlock.values.name || "").trim() : "";
  const safeName = rawName
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${safeName || "pseudocode-workspace"}.json`;
}

function importState(snapshot) {
  const rawBlocks = Array.isArray(snapshot && snapshot.blocks) ? snapshot.blocks : [];

  appState.blocks = rawBlocks.map((block) => sanitizeBlock(block)).filter(Boolean);
  appState.expandedGroups = new Set();
}

function persistToLocalStorage(statusMessage = "Autosaved locally") {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(exportState()));
    updateSaveStatus(statusMessage);
  } catch (error) {
    updateSaveStatus("Local save failed");
  }
}

function restoreFromLocalStorage() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) {
      updateSaveStatus("Autosave ready");
      return false;
    }

    importState(JSON.parse(saved));
    return true;
  } catch (error) {
    updateSaveStatus("Autosave unavailable");
    return false;
  }
}

function saveProjectToFile() {
  persistToLocalStorage("Saved locally");

  const blob = new Blob([JSON.stringify(exportState(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = buildProjectFileName();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  updateSaveStatus("Saved file and local autosave");
}

async function loadProjectFromFile(file) {
  try {
    const text = await file.text();
    importState(JSON.parse(text));
    renderAll();
    updateSaveStatus("Loaded project file");
  } catch (error) {
    updateSaveStatus("Load failed");
  }
}

function createDefaultValues(type) {
  const values = {};
  for (const field of type.fields) {
    values[field.key] = field.default || "";
  }

  return values;
}

function buildTypePreviewLines(type) {
  const values = createDefaultValues(type);

  if (type.line) {
    return [type.line(values)];
  }

  const lines = [];
  for (const section of type.sections) {
    if (section.kind === "line") {
      lines.push(section.text(values));
      continue;
    }

    lines.push(`  [${section.label}]`);
  }

  return lines;
}

function totalBlocks(blocks = appState.blocks) {
  return blocks.reduce((count, block) => {
    const type = getType(block.typeId);
    if (!type.sections) {
      return count + 1;
    }

    let nestedCount = 0;
    for (const section of type.sections) {
      if (section.kind === "zone") {
        nestedCount += totalBlocks(block.zones[section.key]);
      }
    }

    return count + 1 + nestedCount;
  }, 0);
}

function findBlockLocation(blockId, blocks = appState.blocks, ownerId = "", zoneName = "root") {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (block.id === blockId) {
      return {
        block,
        parentArray: blocks,
        index,
        ownerId,
        zoneName
      };
    }

    const type = getType(block.typeId);
    for (const section of type.sections || []) {
      if (section.kind !== "zone") {
        continue;
      }

      const result = findBlockLocation(blockId, block.zones[section.key], block.id, section.key);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

function getZoneArray(ownerId, zoneName) {
  if (!ownerId || zoneName === "root") {
    return appState.blocks;
  }

  const owner = findBlockLocation(ownerId);
  if (!owner) {
    return null;
  }

  return owner.block.zones[zoneName];
}

function blockContainsId(block, maybeDescendantId) {
  if (!maybeDescendantId) {
    return false;
  }

  if (block.id === maybeDescendantId) {
    return true;
  }

  const type = getType(block.typeId);
  for (const section of type.sections || []) {
    if (section.kind !== "zone") {
      continue;
    }

    for (const child of block.zones[section.key]) {
      if (blockContainsId(child, maybeDescendantId)) {
        return true;
      }
    }
  }

  return false;
}

function removeBlock(blockId) {
  const location = findBlockLocation(blockId);
  if (!location) {
    return null;
  }

  location.parentArray.splice(location.index, 1);
  return location.block;
}

function moveBlock(blockId, targetOwnerId, targetZoneName, targetIndex) {
  const source = findBlockLocation(blockId);
  const targetArray = getZoneArray(targetOwnerId, targetZoneName);
  if (!source || !targetArray) {
    return;
  }

  if (source.parentArray === targetArray && source.index < targetIndex) {
    targetIndex -= 1;
  }

  const [block] = source.parentArray.splice(source.index, 1);
  targetArray.splice(targetIndex, 0, block);
}

function addBlock(typeId, targetOwnerId = "", targetZoneName = "root", targetIndex = null) {
  const targetArray = getZoneArray(targetOwnerId, targetZoneName);
  if (!targetArray) {
    return;
  }

  const block = createBlock(typeId);
  const index = targetIndex === null ? targetArray.length : targetIndex;
  targetArray.splice(index, 0, block);
}

function moveBlockByStep(blockId, direction) {
  const location = findBlockLocation(blockId);
  if (!location) {
    return;
  }

  const targetIndex = location.index + direction;
  if (targetIndex < 0 || targetIndex >= location.parentArray.length) {
    return;
  }

  const [block] = location.parentArray.splice(location.index, 1);
  location.parentArray.splice(targetIndex, 0, block);
}

function blockLineText(block) {
  const type = getType(block.typeId);
  return type.line(block.values);
}

function blockToLines(block, depth = 0) {
  const type = getType(block.typeId);
  const pad = "    ".repeat(depth);

  if (type.line) {
    return [`${pad}${type.line(block.values)}`];
  }

  const lines = [];
  for (const section of type.sections) {
    if (section.kind === "line") {
      lines.push(`${pad}${section.text(block.values)}`);
      continue;
    }

    const children = block.zones[section.key];
    if (children.length === 0) {
      lines.push(`${pad}    // ${section.hint}`);
      continue;
    }

    for (const child of children) {
      lines.push(...blockToLines(child, depth + 1));
    }
  }

  return lines;
}

function buildPreviewText() {
  if (appState.blocks.length === 0) {
    return [
      "// Start by adding a block from the syntax library.",
      "// Double-click a block to edit its text.",
      "// Drag blocks into nested zones to create control structures."
    ].join("\n");
  }

  return appState.blocks.flatMap((block) => blockToLines(block)).join("\n");
}

function renderLibrary() {
  const groupsHtml = GROUP_ORDER.map((groupName) => {
    const items = BLOCK_TYPES.filter((type) => type.category === groupName);
    const isOpen = appState.expandedGroups.has(groupName);
    const itemsHtml = items.map((type) => `
      <div class="library-item" draggable="true" data-role="palette-item" data-type-id="${type.id}">
        <div>
          <strong>${escapeHtml(type.label)}</strong>
          <pre class="library-syntax">${escapeHtml(buildTypePreviewLines(type).join("\n"))}</pre>
        </div>
        <button class="mini-button" type="button" data-action="add-block" data-type-id="${type.id}">Add</button>
      </div>
    `).join("");

    return `
      <section class="library-group ${isOpen ? "is-open" : ""}">
        <button class="library-toggle" type="button" data-action="toggle-group" data-group-name="${groupName}" aria-expanded="${isOpen}">
          <span>${escapeHtml(groupName)}</span>
          <span class="library-count">${items.length}</span>
          <span class="library-chevron">v</span>
        </button>
        <div class="library-items">${itemsHtml}</div>
      </section>
    `;
  }).join("");

  dom.libraryGroups.innerHTML = groupsHtml;
}

function renderZone(ownerId, zoneName, blocks, label = "", hint = "") {
  const slots = [];
  const emptyState = blocks.length === 0;

  if (label) {
    slots.push(`
      <div class="zone-header">
        <div class="branch-label">${escapeHtml(label)}</div>
        <p class="zone-hint">${escapeHtml(hint)}</p>
      </div>
    `);
  }

  const emptyClass = emptyState ? " zone-slot--empty" : "";
  slots.push(`
    <div class="zone-slot${emptyClass}" data-role="drop-slot" data-owner-id="${ownerId}" data-zone-name="${zoneName}" data-index="0">
      ${emptyState ? escapeHtml(hint || "Drop a block here.") : ""}
    </div>
  `);

  blocks.forEach((block, index) => {
    slots.push(renderBlock(block));
    slots.push(`
      <div class="zone-slot" data-role="drop-slot" data-owner-id="${ownerId}" data-zone-name="${zoneName}" data-index="${index + 1}"></div>
    `);
  });

  return `<div class="zone-stack">${slots.join("")}</div>`;
}

function renderBlock(block) {
  const type = getType(block.typeId);
  const linesHtml = [];

  if (type.line) {
    linesHtml.push(`<div class="code-line">${escapeHtml(blockLineText(block))}</div>`);
  } else {
    for (const section of type.sections) {
      if (section.kind === "line") {
        linesHtml.push(`<div class="code-line">${escapeHtml(section.text(block.values))}</div>`);
        continue;
      }

      linesHtml.push(`
        <section class="zone-section">
          ${renderZone(block.id, section.key, block.zones[section.key], section.label, section.hint)}
        </section>
      `);
    }
  }

  return `
    <article class="block-card" data-role="block-card" data-block-id="${block.id}">
      <div class="block-frame">
        <div class="block-toolbar">
          <div class="block-toolbar-left">
            <button class="block-grip" type="button" draggable="true" data-role="block-dragger" data-block-id="${block.id}" title="Drag block">Drag</button>
            <span class="block-tag">${escapeHtml(type.label)}</span>
          </div>
          <div class="block-controls">
            <button class="block-control" type="button" data-action="edit-block" data-block-id="${block.id}" title="Edit block" aria-label="Edit block">&#9998;</button>
            <button class="block-control" type="button" data-action="move-up" data-block-id="${block.id}" title="Move block up" aria-label="Move block up">&#8593;</button>
            <button class="block-control" type="button" data-action="move-down" data-block-id="${block.id}" title="Move block down" aria-label="Move block down">&#8595;</button>
            <button class="block-control block-control--danger" type="button" data-action="delete-block" data-block-id="${block.id}" title="Delete block" aria-label="Delete block">&#10005;</button>
          </div>
        </div>
        <div class="block-content">
          ${linesHtml.join("")}
        </div>
      </div>
    </article>
  `;
}

function renderCanvas() {
  dom.canvasRoot.innerHTML = renderZone("", "root", appState.blocks, "", "Drop your first block here or use Add from the library.");
  dom.outputPreview.textContent = buildPreviewText();
  const count = totalBlocks();
  dom.workspaceSummary.textContent = `${count} block${count === 1 ? "" : "s"} in workspace`;
  dom.copyOutputBtn.disabled = count === 0;
  persistToLocalStorage();
}

function renderAll() {
  renderLibrary();
  renderCanvas();
}

function getBlockById(blockId) {
  const location = findBlockLocation(blockId);
  return location ? location.block : null;
}

function openEditor(blockId) {
  const block = getBlockById(blockId);
  if (!block) {
    return;
  }

  const type = getType(block.typeId);
  appState.editingBlockId = blockId;
  dom.editorTitle.textContent = `Edit ${type.label}`;

  dom.editorFields.innerHTML = type.fields.map((field) => {
    const value = block.values[field.key] || "";
    let control = "";

    if (field.inputType === "select") {
      const options = (field.options || []).map((option) => {
        const selected = option === value ? " selected" : "";
        return `<option value="${escapeHtml(option)}"${selected}>${escapeHtml(option)}</option>`;
      }).join("");
      control = `<select name="${field.key}" id="field-${field.key}">${options}</select>`;
    } else if (field.multiline) {
      control = `<textarea name="${field.key}" id="field-${field.key}">${escapeHtml(value)}</textarea>`;
    } else {
      control = `<input type="text" name="${field.key}" id="field-${field.key}" value="${escapeHtml(value)}">`;
    }

    return `
      <div class="field-group">
        <label for="field-${field.key}">${escapeHtml(field.label)}</label>
        ${control}
      </div>
    `;
  }).join("");

  dom.editorBackdrop.classList.remove("is-hidden");
  dom.editorBackdrop.setAttribute("aria-hidden", "false");

  const firstField = dom.editorFields.querySelector("input, select, textarea");
  if (firstField) {
    firstField.focus();
    if (typeof firstField.select === "function") {
      firstField.select();
    }
  }
}

function closeEditor() {
  appState.editingBlockId = null;
  dom.editorBackdrop.classList.add("is-hidden");
  dom.editorBackdrop.setAttribute("aria-hidden", "true");
  dom.editorFields.innerHTML = "";
}

function clearDropHighlights() {
  document.querySelectorAll(".zone-slot.is-active").forEach((slot) => {
    slot.classList.remove("is-active");
  });
}

async function copyPreview() {
  const previewText = buildPreviewText();
  try {
    await navigator.clipboard.writeText(previewText);
    dom.copyOutputBtn.textContent = "Copied";
  } catch (error) {
    dom.copyOutputBtn.textContent = "Copy failed";
  }

  window.setTimeout(() => {
    dom.copyOutputBtn.textContent = "Copy pseudocode";
  }, 1200);
}

function isDropAllowed(targetOwnerId) {
  if (!appState.dragData) {
    return false;
  }

  if (appState.dragData.kind === "palette") {
    return true;
  }

  const dragged = getBlockById(appState.dragData.blockId);
  if (!dragged) {
    return false;
  }

  return !blockContainsId(dragged, targetOwnerId);
}

function handleDrop(targetOwnerId, targetZoneName, targetIndex) {
  if (!appState.dragData) {
    return;
  }

  if (!isDropAllowed(targetOwnerId)) {
    clearDropHighlights();
    return;
  }

  if (appState.dragData.kind === "palette") {
    addBlock(appState.dragData.typeId, targetOwnerId, targetZoneName, targetIndex);
  } else if (appState.dragData.kind === "block") {
    moveBlock(appState.dragData.blockId, targetOwnerId, targetZoneName, targetIndex);
  }

  appState.dragData = null;
  clearDropHighlights();
  renderCanvas();
}

dom.libraryGroups.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-action='toggle-group']");
  if (toggle) {
    const groupName = toggle.dataset.groupName;
    if (appState.expandedGroups.has(groupName)) {
      appState.expandedGroups.delete(groupName);
    } else {
      appState.expandedGroups = new Set([groupName]);
    }

    renderLibrary();
    return;
  }

  const addButton = event.target.closest("[data-action='add-block']");
  if (addButton) {
    addBlock(addButton.dataset.typeId);
    renderCanvas();
  }
});

dom.libraryGroups.addEventListener("dragstart", (event) => {
  const item = event.target.closest("[data-role='palette-item']");
  if (!item) {
    return;
  }

  appState.dragData = {
    kind: "palette",
    typeId: item.dataset.typeId
  };

  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData("text/plain", item.dataset.typeId);
});

dom.libraryGroups.addEventListener("dragend", () => {
  appState.dragData = null;
  clearDropHighlights();
});

dom.canvasRoot.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const blockId = actionButton.dataset.blockId;

  switch (actionButton.dataset.action) {
    case "edit-block":
      openEditor(blockId);
      break;
    case "move-up":
      moveBlockByStep(blockId, -1);
      renderCanvas();
      break;
    case "move-down":
      moveBlockByStep(blockId, 1);
      renderCanvas();
      break;
    case "delete-block":
      removeBlock(blockId);
      renderCanvas();
      break;
    default:
      break;
  }
});

dom.canvasRoot.addEventListener("dblclick", (event) => {
  if (event.target.closest("[data-action]")) {
    return;
  }

  const card = event.target.closest("[data-role='block-card']");
  if (!card) {
    return;
  }

  openEditor(card.dataset.blockId);
});

dom.canvasRoot.addEventListener("dragstart", (event) => {
  const dragger = event.target.closest("[data-role='block-dragger']");
  if (!dragger) {
    return;
  }

  appState.dragData = {
    kind: "block",
    blockId: dragger.dataset.blockId
  };

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", dragger.dataset.blockId);
});

dom.canvasRoot.addEventListener("dragend", () => {
  appState.dragData = null;
  clearDropHighlights();
});

dom.canvasRoot.addEventListener("dragover", (event) => {
  const slot = event.target.closest("[data-role='drop-slot']");
  if (!slot || !isDropAllowed(slot.dataset.ownerId)) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = appState.dragData && appState.dragData.kind === "palette" ? "copy" : "move";
  clearDropHighlights();
  slot.classList.add("is-active");
});

dom.canvasRoot.addEventListener("dragleave", (event) => {
  const slot = event.target.closest("[data-role='drop-slot']");
  if (slot && !slot.contains(event.relatedTarget)) {
    slot.classList.remove("is-active");
  }
});

dom.canvasRoot.addEventListener("drop", (event) => {
  const slot = event.target.closest("[data-role='drop-slot']");
  if (!slot) {
    return;
  }

  event.preventDefault();
  handleDrop(slot.dataset.ownerId, slot.dataset.zoneName, Number(slot.dataset.index));
});

dom.copyOutputBtn.addEventListener("click", () => {
  copyPreview();
});

dom.saveProjectBtn.addEventListener("click", () => {
  saveProjectToFile();
});

dom.loadProjectBtn.addEventListener("click", () => {
  dom.loadProjectInput.click();
});

dom.loadProjectInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  await loadProjectFromFile(file);
  event.target.value = "";
});

dom.clearCanvasBtn.addEventListener("click", () => {
  if (appState.blocks.length === 0) {
    return;
  }

  if (window.confirm("Clear the entire workspace?")) {
    appState.blocks = [];
    renderCanvas();
  }
});

dom.closeEditorBtn.addEventListener("click", closeEditor);
dom.cancelEditorBtn.addEventListener("click", closeEditor);

dom.editorBackdrop.addEventListener("click", (event) => {
  if (event.target === dom.editorBackdrop) {
    closeEditor();
  }
});

dom.editorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const block = getBlockById(appState.editingBlockId);
  if (!block) {
    closeEditor();
    return;
  }

  const formData = new FormData(dom.editorForm);
  const type = getType(block.typeId);
  for (const field of type.fields) {
    block.values[field.key] = String(formData.get(field.key) || "").trim();
  }

  closeEditor();
  renderCanvas();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && appState.editingBlockId) {
    closeEditor();
  }
});

const restoredAutosave = restoreFromLocalStorage();
renderAll();
if (restoredAutosave) {
  updateSaveStatus("Restored local autosave");
}
