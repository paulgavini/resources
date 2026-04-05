const LOCAL_STORAGE_KEY = "blockly-pseudo-autosave-v1";
const PROJECT_VERSION = 1;
const PROJECT_FORMAT = "blockly-pseudo";
const INFO_GLYPH = " ⓘ";

const EMPTY_PREVIEW_MESSAGE = [
  "// Start by adding a block from the toolbox.",
  "// Edit field values directly on the blocks.",
  "// The preview updates automatically as the workspace changes."
].join("\n");

const BLOCK_COLOURS = {
  structure: "#2d5ecf",
  variables: "#2c7a63",
  io: "#8956bc",
  selection: "#c06a1c",
  iteration: "#8a3f59",
  functions: "#5366b7"
};

const DATA_TYPES = [
  "INTEGER",
  "REAL",
  "STRING",
  "BOOLEAN",
  "CHARACTER",
  "DATE",
  "ARRAY",
  "RECORD"
];

const BLOCK_TOOLTIPS = {
  pseudo_program: "Use Program to show the main algorithm. Most solutions should have one Program block that contains the steps in order.",
  pseudo_step: "A statement is a plain action written in simple English-like pseudocode. Use it for steps that do not need a special control block.",
  pseudo_comment: "A comment explains your thinking for a human reader. Comments help understanding and are not actions the algorithm carries out.",
  pseudo_declare: "Declare introduces a variable before you use it. A variable stores data, and the data type tells what kind of value it should hold.",
  pseudo_set: "Set changes the value stored in a variable. Use it to give a starting value or to update a value during the algorithm.",
  pseudo_input: "Input gets data from a user, a sensor, or another source. Save the input into a variable so later steps can use it.",
  pseudo_output: "Output shows information to the user. Use it for messages, answers, or values you want to display.",
  pseudo_if: "IF is a selection block. It runs the indented steps only when the condition is true.",
  pseudo_if_else: "IF / ELSE is a selection block with two paths. One path runs when the condition is true and the other runs when it is false.",
  pseudo_while: "WHILE is an iteration block. It repeats the steps while the condition stays true, so make sure something inside the loop can change the condition.",
  pseudo_for: "FOR is a counting loop. Use it when you know the start, end, and optional step size for the repetition.",
  pseudo_repeat_until: "REPEAT UNTIL repeats the steps first and checks the condition at the end. That means the loop body runs at least once.",
  pseudo_function: "A function is a reusable group of steps that sends back a result with RETURN. Use functions for calculations or logic that produce a value.",
  pseudo_procedure: "A procedure is a reusable group of steps that does a job but does not return a value. Use it to organise longer algorithms into named parts.",
  pseudo_call: "CALL runs a function or procedure that has already been defined. Arguments are the values you send into that routine.",
  pseudo_return: "RETURN sends a result back from a function. After RETURN, the function finishes and gives that value to the caller."
};

const dom = {
  blocklyHost: document.querySelector("#blocklyHost"),
  outputPreview: document.querySelector("#outputPreview"),
  workspaceSummary: document.querySelector("#workspaceSummary"),
  validationBanner: document.querySelector("#validationBanner"),
  saveStatus: document.querySelector("#saveStatus"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  loadProjectBtn: document.querySelector("#loadProjectBtn"),
  copyOutputBtn: document.querySelector("#copyOutputBtn"),
  clearWorkspaceBtn: document.querySelector("#clearWorkspaceBtn"),
  loadProjectInput: document.querySelector("#loadProjectInput")
};

let workspace = null;
let autosaveTimer = 0;
let isApplyingWorkspaceState = false;
let statusResetTimer = 0;

function defineBlocklyTheme() {
  return Blockly.Theme.defineTheme("blocklyPseudoTheme", {
    base: Blockly.Themes.Classic,
    blockStyles: {
      structure_blocks: {
        colourPrimary: BLOCK_COLOURS.structure,
        colourSecondary: "#224fb2",
        colourTertiary: "#183f92"
      },
      variables_blocks: {
        colourPrimary: BLOCK_COLOURS.variables,
        colourSecondary: "#236a56",
        colourTertiary: "#1b5546"
      },
      io_blocks: {
        colourPrimary: BLOCK_COLOURS.io,
        colourSecondary: "#7544a6",
        colourTertiary: "#5f3589"
      },
      selection_blocks: {
        colourPrimary: BLOCK_COLOURS.selection,
        colourSecondary: "#a75b17",
        colourTertiary: "#8d4c10"
      },
      iteration_blocks: {
        colourPrimary: BLOCK_COLOURS.iteration,
        colourSecondary: "#74344a",
        colourTertiary: "#5d2538"
      },
      functions_blocks: {
        colourPrimary: BLOCK_COLOURS.functions,
        colourSecondary: "#43549d",
        colourTertiary: "#34417a"
      }
    },
    categoryStyles: {
      structure_category: {colour: BLOCK_COLOURS.structure},
      variables_category: {colour: BLOCK_COLOURS.variables},
      io_category: {colour: BLOCK_COLOURS.io},
      selection_category: {colour: BLOCK_COLOURS.selection},
      iteration_category: {colour: BLOCK_COLOURS.iteration},
      functions_category: {colour: BLOCK_COLOURS.functions}
    },
    componentStyles: {
      workspaceBackgroundColour: "#f8fbff",
      toolboxBackgroundColour: "#f3f7ff",
      toolboxForegroundColour: "#152033",
      flyoutBackgroundColour: "#f8fbff",
      flyoutForegroundColour: "#152033",
      flyoutOpacity: 1,
      scrollbarColour: "#b9c6e5",
      insertionMarkerColour: "#2d5ecf",
      insertionMarkerOpacity: 0.35,
      markerColour: "#2d5ecf",
      cursorColour: "#2d5ecf"
    },
    fontStyle: {
      family: "\"Trebuchet MS\", \"Segoe UI\", sans-serif",
      weight: "300",
      size: 12
    }
  });
}

function withInfoGlyph(message) {
  return message;
}

function getFieldValue(block, fieldName) {
  return String(block.getFieldValue(fieldName) || "").trim();
}

function defineCustomBlocks() {
  const blockDefinitions = [
    {
      type: "pseudo_program",
      message0: withInfoGlyph("PROGRAM %1"),
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "MainRoutine"
        }
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "BODY"
        }
      ],
      message2: "ENDPROGRAM",
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_program
    },
    {
      type: "pseudo_step",
      message0: withInfoGlyph("%1"),
      args0: [
        {
          type: "field_input",
          name: "TEXT",
          text: "Process the data"
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_step
    },
    {
      type: "pseudo_comment",
      message0: withInfoGlyph("// %1"),
      args0: [
        {
          type: "field_input",
          name: "TEXT",
          text: "Explain what happens here"
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_comment
    },
    {
      type: "pseudo_declare",
      message0: withInfoGlyph("DECLARE %1 AS %2"),
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "score"
        },
        {
          type: "field_dropdown",
          name: "DATA_TYPE",
          options: DATA_TYPES.map((option) => [option, option])
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "variables_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_declare
    },
    {
      type: "pseudo_set",
      message0: withInfoGlyph("SET %1 = %2"),
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "score"
        },
        {
          type: "field_input",
          name: "EXPRESSION",
          text: "0"
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "variables_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_set
    },
    {
      type: "pseudo_input",
      message0: withInfoGlyph("INPUT %1"),
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "userChoice"
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "io_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_input
    },
    {
      type: "pseudo_output",
      message0: withInfoGlyph("OUTPUT %1"),
      args0: [
        {
          type: "field_input",
          name: "VALUE",
          text: "\"Ready\""
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "io_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_output
    },
    {
      type: "pseudo_if",
      message0: withInfoGlyph("IF %1 THEN"),
      args0: [
        {
          type: "field_input",
          name: "CONDITION",
          text: "score >= 50"
        }
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "THEN"
        }
      ],
      message2: "ENDIF",
      previousStatement: null,
      nextStatement: null,
      style: "selection_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_if
    },
    {
      type: "pseudo_if_else",
      message0: withInfoGlyph("IF %1 THEN"),
      args0: [
        {
          type: "field_input",
          name: "CONDITION",
          text: "score >= 50"
        }
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "THEN"
        }
      ],
      message2: "ELSE",
      message3: "%1",
      args3: [
        {
          type: "input_statement",
          name: "ELSE"
        }
      ],
      message4: "ENDIF",
      previousStatement: null,
      nextStatement: null,
      style: "selection_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_if_else
    },
    {
      type: "pseudo_while",
      message0: withInfoGlyph("WHILE %1"),
      args0: [
        {
          type: "field_input",
          name: "CONDITION",
          text: "itemCount < 10"
        }
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "BODY"
        }
      ],
      message2: "ENDWHILE",
      previousStatement: null,
      nextStatement: null,
      style: "iteration_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_while
    },
    {
      type: "pseudo_for",
      message0: withInfoGlyph("FOR %1 = %2 TO %3 STEP %4"),
      args0: [
        {
          type: "field_input",
          name: "COUNTER",
          text: "index"
        },
        {
          type: "field_input",
          name: "START",
          text: "1"
        },
        {
          type: "field_input",
          name: "END",
          text: "10"
        },
        {
          type: "field_input",
          name: "STEP",
          text: "1"
        }
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "BODY"
        }
      ],
      message2: "NEXT",
      previousStatement: null,
      nextStatement: null,
      style: "iteration_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_for
    },
    {
      type: "pseudo_repeat_until",
      message0: withInfoGlyph("REPEAT"),
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "BODY"
        }
      ],
      message2: "UNTIL %1",
      args2: [
        {
          type: "field_input",
          name: "CONDITION",
          text: "userChoice = \"quit\""
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "iteration_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_repeat_until
    },
    {
      type: "pseudo_function",
      message0: withInfoGlyph("FUNCTION %1(%2)"),
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "calculateAverage"
        },
        {
          type: "field_input",
          name: "PARAMETERS",
          text: "total, count"
        }
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "BODY"
        }
      ],
      message2: "ENDFUNCTION",
      style: "functions_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_function
    },
    {
      type: "pseudo_procedure",
      message0: withInfoGlyph("PROCEDURE %1(%2)"),
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "displayMenu"
        },
        {
          type: "field_input",
          name: "PARAMETERS",
          text: ""
        }
      ],
      message1: "%1",
      args1: [
        {
          type: "input_statement",
          name: "BODY"
        }
      ],
      message2: "ENDPROCEDURE",
      style: "functions_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_procedure
    },
    {
      type: "pseudo_call",
      message0: withInfoGlyph("CALL %1(%2)"),
      args0: [
        {
          type: "field_input",
          name: "NAME",
          text: "displayMenu"
        },
        {
          type: "field_input",
          name: "ARGUMENTS",
          text: ""
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "functions_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_call
    },
    {
      type: "pseudo_return",
      message0: withInfoGlyph("RETURN %1"),
      args0: [
        {
          type: "field_input",
          name: "VALUE",
          text: "average"
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: "functions_blocks",
      tooltip: BLOCK_TOOLTIPS.pseudo_return
    }
  ];

  if (Blockly.common && Blockly.common.defineBlocksWithJsonArray) {
    Blockly.common.defineBlocksWithJsonArray(blockDefinitions);
    return;
  }

  Blockly.defineBlocksWithJsonArray(blockDefinitions);
}

function createToolbox() {
  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: "Structure",
        categorystyle: "structure_category",
        contents: [
          {kind: "block", type: "pseudo_program"},
          {kind: "block", type: "pseudo_step"},
          {kind: "block", type: "pseudo_comment"}
        ]
      },
      {
        kind: "category",
        name: "Variables",
        categorystyle: "variables_category",
        contents: [
          {kind: "block", type: "pseudo_declare"},
          {kind: "block", type: "pseudo_set"}
        ]
      },
      {
        kind: "category",
        name: "Input / Output",
        categorystyle: "io_category",
        contents: [
          {kind: "block", type: "pseudo_input"},
          {kind: "block", type: "pseudo_output"}
        ]
      },
      {
        kind: "category",
        name: "Selection",
        categorystyle: "selection_category",
        contents: [
          {kind: "block", type: "pseudo_if"},
          {kind: "block", type: "pseudo_if_else"}
        ]
      },
      {
        kind: "category",
        name: "Iteration",
        categorystyle: "iteration_category",
        contents: [
          {kind: "block", type: "pseudo_while"},
          {kind: "block", type: "pseudo_for"},
          {kind: "block", type: "pseudo_repeat_until"}
        ]
      },
      {
        kind: "category",
        name: "Functions",
        categorystyle: "functions_category",
        contents: [
          {kind: "block", type: "pseudo_function"},
          {kind: "block", type: "pseudo_procedure"},
          {kind: "block", type: "pseudo_call"},
          {kind: "block", type: "pseudo_return"}
        ]
      }
    ]
  };
}

function createPseudoGenerator() {
  const generator = new Blockly.Generator("PSEUDO");
  generator.INDENT = "    ";
  generator.PASS = "";

  generator.init = function() {};
  generator.finish = function(code) {
    return code;
  };
  generator.scrubNakedValue = function(line) {
    return line;
  };
  generator.scrub_ = function(block, code, thisOnly) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    const nextCode = !thisOnly && nextBlock ? generator.blockToCode(nextBlock) : "";
    return code + nextCode;
  };

  generator.forBlock.pseudo_program = function(block, innerGenerator) {
    const body = innerGenerator.statementToCode(block, "BODY");
    return `PROGRAM ${getFieldValue(block, "NAME")}\n${body}ENDPROGRAM\n`;
  };

  generator.forBlock.pseudo_step = function(block) {
    return `${getFieldValue(block, "TEXT")}\n`;
  };

  generator.forBlock.pseudo_comment = function(block) {
    return `// ${getFieldValue(block, "TEXT")}\n`;
  };

  generator.forBlock.pseudo_declare = function(block) {
    return `DECLARE ${getFieldValue(block, "NAME")} AS ${getFieldValue(block, "DATA_TYPE")}\n`;
  };

  generator.forBlock.pseudo_set = function(block) {
    return `SET ${getFieldValue(block, "NAME")} = ${getFieldValue(block, "EXPRESSION")}\n`;
  };

  generator.forBlock.pseudo_input = function(block) {
    return `INPUT ${getFieldValue(block, "NAME")}\n`;
  };

  generator.forBlock.pseudo_output = function(block) {
    return `OUTPUT ${getFieldValue(block, "VALUE")}\n`;
  };

  generator.forBlock.pseudo_if = function(block, innerGenerator) {
    const body = innerGenerator.statementToCode(block, "THEN");
    return `IF ${getFieldValue(block, "CONDITION")} THEN\n${body}ENDIF\n`;
  };

  generator.forBlock.pseudo_if_else = function(block, innerGenerator) {
    const thenBody = innerGenerator.statementToCode(block, "THEN");
    const elseBody = innerGenerator.statementToCode(block, "ELSE");
    return `IF ${getFieldValue(block, "CONDITION")} THEN\n${thenBody}ELSE\n${elseBody}ENDIF\n`;
  };

  generator.forBlock.pseudo_while = function(block, innerGenerator) {
    const body = innerGenerator.statementToCode(block, "BODY");
    return `WHILE ${getFieldValue(block, "CONDITION")}\n${body}ENDWHILE\n`;
  };

  generator.forBlock.pseudo_for = function(block, innerGenerator) {
    const step = getFieldValue(block, "STEP");
    const stepPart = step && step !== "1" ? ` STEP ${step}` : "";
    const body = innerGenerator.statementToCode(block, "BODY");
    return `FOR ${getFieldValue(block, "COUNTER")} = ${getFieldValue(block, "START")} TO ${getFieldValue(block, "END")}${stepPart}\n${body}NEXT\n`;
  };

  generator.forBlock.pseudo_repeat_until = function(block, innerGenerator) {
    const body = innerGenerator.statementToCode(block, "BODY");
    return `REPEAT\n${body}UNTIL ${getFieldValue(block, "CONDITION")}\n`;
  };

  generator.forBlock.pseudo_function = function(block, innerGenerator) {
    const body = innerGenerator.statementToCode(block, "BODY");
    return `FUNCTION ${getFieldValue(block, "NAME")}(${getFieldValue(block, "PARAMETERS")})\n${body}ENDFUNCTION\n`;
  };

  generator.forBlock.pseudo_procedure = function(block, innerGenerator) {
    const body = innerGenerator.statementToCode(block, "BODY");
    return `PROCEDURE ${getFieldValue(block, "NAME")}(${getFieldValue(block, "PARAMETERS")})\n${body}ENDPROCEDURE\n`;
  };

  generator.forBlock.pseudo_call = function(block) {
    return `CALL ${getFieldValue(block, "NAME")}(${getFieldValue(block, "ARGUMENTS")})\n`;
  };

  generator.forBlock.pseudo_return = function(block) {
    return `RETURN ${getFieldValue(block, "VALUE")}\n`;
  };

  return generator;
}

const pseudoGenerator = createPseudoGenerator();

function updateSaveStatus(message, tone = "neutral") {
  dom.saveStatus.textContent = message;
  dom.saveStatus.dataset.tone = tone;
}

function updateValidationBanner(message, tone) {
  dom.validationBanner.textContent = message;
  dom.validationBanner.dataset.tone = tone;
}

function countAllBlocks() {
  return workspace ? workspace.getAllBlocks(false).length : 0;
}

function getTopBlocks() {
  return workspace ? workspace.getTopBlocks(true) : [];
}

function getProgramBlocks() {
  return getTopBlocks().filter((block) => block.type === "pseudo_program");
}

function buildPreviewText() {
  const topBlocks = getTopBlocks();
  if (topBlocks.length === 0) {
    return EMPTY_PREVIEW_MESSAGE;
  }

  return topBlocks
    .map((block) => pseudoGenerator.blockToCode(block))
    .map((code) => String(code || "").trimEnd())
    .filter(Boolean)
    .join("\n");
}

function updateWorkspaceSummary() {
  const count = countAllBlocks();
  dom.workspaceSummary.textContent = `${count} block${count === 1 ? "" : "s"} in workspace`;
  dom.copyOutputBtn.disabled = count === 0;
  dom.clearWorkspaceBtn.disabled = count === 0;
}

function updateValidationState() {
  const programCount = getProgramBlocks().length;

  if (programCount === 0) {
    updateValidationBanner("Add one Program block to define the main routine.", "warning");
    return;
  }

  if (programCount > 1) {
    updateValidationBanner("Use one top-level Program block for the main flow. Multiple Program blocks are currently present.", "warning");
    return;
  }

  updateValidationBanner("Single Program block ready. The preview will follow top-level block order from top to bottom.", "good");
}

function renderDerivedState() {
  dom.outputPreview.textContent = buildPreviewText();
  updateWorkspaceSummary();
  updateValidationState();
}

function exportProject() {
  return {
    version: PROJECT_VERSION,
    format: PROJECT_FORMAT,
    workspace: Blockly.serialization.workspaces.save(workspace)
  };
}

function isValidProjectFile(payload) {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    payload.version === PROJECT_VERSION &&
    payload.format === PROJECT_FORMAT &&
    payload.workspace &&
    typeof payload.workspace === "object"
  );
}

function resetStatusLater() {
  window.clearTimeout(statusResetTimer);
  statusResetTimer = window.setTimeout(() => {
    updateSaveStatus("Autosave ready");
  }, 1800);
}

function persistToLocalStorage(message = "Autosaved locally", tone = "good") {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(exportProject()));
    updateSaveStatus(message, tone);
  } catch (error) {
    updateSaveStatus("Local save failed", "warning");
  }
}

function scheduleAutosave() {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    persistToLocalStorage("Autosaved locally", "good");
    resetStatusLater();
  }, 140);
}

function replaceWorkspaceState(serializedWorkspace) {
  isApplyingWorkspaceState = true;

  try {
    Blockly.Events.disable();
    workspace.clear();
    Blockly.serialization.workspaces.load(serializedWorkspace || {}, workspace);
    workspace.clearUndo();
  } finally {
    Blockly.Events.enable();
    isApplyingWorkspaceState = false;
  }

  renderDerivedState();
}

function sanitizeProjectFileName(rawName) {
  const safeName = String(rawName || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return safeName || "blockly-pseudo-workspace";
}

function buildProjectFileName() {
  const programBlock = getProgramBlocks()[0];
  const programName = programBlock ? programBlock.getFieldValue("NAME") : "";
  return `${sanitizeProjectFileName(programName)}.json`;
}

async function copyPreviewToClipboard() {
  try {
    await navigator.clipboard.writeText(dom.outputPreview.textContent);
    updateSaveStatus("Copied pseudocode", "good");
  } catch (error) {
    updateSaveStatus("Copy failed", "warning");
  }

  resetStatusLater();
}

function saveProjectToFile() {
  persistToLocalStorage("Saved locally", "good");

  const blob = new Blob([JSON.stringify(exportProject(), null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = buildProjectFileName();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  updateSaveStatus("Saved file and local autosave", "good");
}

async function loadProjectFromFile(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!isValidProjectFile(payload)) {
      updateSaveStatus("Load failed: only blockly-pseudo project files are supported", "warning");
      return;
    }

    replaceWorkspaceState(payload.workspace);
    persistToLocalStorage("Loaded project file", "good");
  } catch (error) {
    updateSaveStatus("Load failed", "warning");
  }
}

function restoreAutosave() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) {
      updateSaveStatus("Autosave ready");
      return false;
    }

    const payload = JSON.parse(saved);
    if (!isValidProjectFile(payload)) {
      updateSaveStatus("Autosave unavailable", "warning");
      return false;
    }

    replaceWorkspaceState(payload.workspace);
    updateSaveStatus("Restored local autosave", "good");
    resetStatusLater();
    return true;
  } catch (error) {
    updateSaveStatus("Autosave unavailable", "warning");
    return false;
  }
}

function handleWorkspaceChange(event) {
  if (isApplyingWorkspaceState || !event || event.isUiEvent) {
    return;
  }

  renderDerivedState();
  scheduleAutosave();
}

function injectWorkspace() {
  workspace = Blockly.inject(dom.blocklyHost, {
    toolbox: createToolbox(),
    theme: defineBlocklyTheme(),
    media: "./vendor/blockly/media/",
    trashcan: true,
    sounds: false,
    move: {
      scrollbars: true,
      drag: true,
      wheel: true
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.95,
      maxScale: 1.5,
      minScale: 0.55,
      scaleSpeed: 1.1
    },
    grid: {
      spacing: 24,
      length: 3,
      colour: "#d6dff0",
      snap: false
    }
  });

  workspace.addChangeListener(handleWorkspaceChange);

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => Blockly.svgResize(workspace));
    observer.observe(dom.blocklyHost);
  }

  window.addEventListener("resize", () => {
    Blockly.svgResize(workspace);
  });
}

function wireUi() {
  dom.copyOutputBtn.addEventListener("click", () => {
    copyPreviewToClipboard();
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

  dom.clearWorkspaceBtn.addEventListener("click", () => {
    if (!workspace || countAllBlocks() === 0) {
      return;
    }

    if (!window.confirm("Clear the entire workspace?")) {
      return;
    }

    replaceWorkspaceState({});
    persistToLocalStorage("Cleared workspace", "good");
  });
}

function initializeApp() {
  defineCustomBlocks();
  injectWorkspace();
  wireUi();
  renderDerivedState();

  const restoredAutosave = restoreAutosave();
  if (!restoredAutosave) {
    renderDerivedState();
  }
}

initializeApp();
