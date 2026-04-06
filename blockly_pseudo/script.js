const LOCAL_STORAGE_KEY = "blockly-pseudo-autosave-v1";
const LAYOUT_SPLIT_STORAGE_KEY = "blockly-pseudo-layout-split-v1";
const PREVIEW_SPLIT_STORAGE_KEY = "blockly-pseudo-preview-split-v1";
const DIAGRAM_FIT_STORAGE_KEY = "blockly-pseudo-diagram-fit-v1";
const PROJECT_VERSION = 1;
const PROJECT_FORMAT = "blockly-pseudo";
const INFO_GLYPH = " ⓘ";
const EMPTY_FLOWCHART_MESSAGE = "Flow diagram will appear here when the workspace contains blocks.";
const DEFAULT_PREVIEW_PANEL_WIDTH = 380;
const MIN_PREVIEW_PANEL_WIDTH = 280;
const MAX_PREVIEW_PANEL_WIDTH = 720;
const DEFAULT_DIAGRAM_PANEL_HEIGHT = 340;
const MIN_DIAGRAM_PANEL_HEIGHT = 220;
const MIN_PSEUDOCODE_PANEL_HEIGHT = 220;
const MIN_WORKSPACE_PANEL_WIDTH = 320;
const DESKTOP_LAYOUT_MEDIA_QUERY = "(max-width: 1100px)";

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
  appLayout: document.querySelector(".app-layout"),
  blocklyHost: document.querySelector("#blocklyHost"),
  layoutDivider: document.querySelector("#layoutDivider"),
  previewStack: document.querySelector("#previewStack"),
  previewDivider: document.querySelector("#previewDivider"),
  outputPreview: document.querySelector("#outputPreview"),
  diagramPreview: document.querySelector("#diagramPreview"),
  diagramStatus: document.querySelector("#diagramStatus"),
  fitDiagramBtn: document.querySelector("#fitDiagramBtn"),
  copyDiagramBtn: document.querySelector("#copyDiagramBtn"),
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
let mermaidConfigured = false;
let mermaidRenderToken = 0;
let layoutDividerDragState = null;
let previewDividerDragState = null;
let diagramFitEnabled = true;
let latestFlowchartText = "";
let latestRenderedDiagramSvg = "";

const desktopLayoutMedia = window.matchMedia(DESKTOP_LAYOUT_MEDIA_QUERY);

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

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMermaidLabel(text) {
  return escapeHtml(String(text || ""))
    .replace(/\|/g, "&#124;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
    .replace(/\(/g, "&#40;")
    .replace(/\)/g, "&#41;")
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, "<br/>")
    .trim() || " ";
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

function updateDiagramStatus(message, tone = "neutral") {
  let visualStatus = message;

  if (tone === "good") {
    visualStatus = "✓";
  } else if (tone === "warning") {
    visualStatus = "✕";
  }

  dom.diagramStatus.textContent = visualStatus;
  dom.diagramStatus.dataset.tone = tone;
  dom.diagramStatus.setAttribute("aria-label", message);
  dom.diagramStatus.title = message;
}

function resizeWorkspaceSurface() {
  if (workspace) {
    Blockly.svgResize(workspace);
  }
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

function createFlowchartBuilder() {
  return {
    nextNodeId: 1,
    nodes: [],
    edges: [],
    classMembers: {
      terminal: [],
      process: [],
      decision: [],
      io: [],
      comment: []
    }
  };
}

function addFlowNode(builder, kind, label) {
  const nodeId = `n${builder.nextNodeId++}`;
  const safeLabel = escapeMermaidLabel(label);
  let declaration = `${nodeId}["${safeLabel}"]`;

  if (kind === "terminal") {
    declaration = `${nodeId}(["${safeLabel}"])`;
  } else if (kind === "io") {
    declaration = `${nodeId}@{ shape: lean-r, label: "${safeLabel}" }`;
  } else if (kind === "decision") {
    declaration = `${nodeId}{"${safeLabel}"}`;
  }

  builder.nodes.push(declaration);
  builder.classMembers[kind].push(nodeId);
  return nodeId;
}

function addFlowEdge(builder, fromId, toId, label = "") {
  if (!fromId || !toId) {
    return;
  }

  if (label) {
    builder.edges.push(`${fromId} -->|${escapeMermaidLabel(label)}| ${toId}`);
    return;
  }

  builder.edges.push(`${fromId} --> ${toId}`);
}

function connectFlowExits(builder, exits, targetId) {
  exits.forEach((exit) => {
    addFlowEdge(builder, exit.fromId, targetId, exit.label);
  });
}

function createLinearSegment(builder, label, kind = "process") {
  const nodeId = addFlowNode(builder, kind, label);
  return {
    entryId: nodeId,
    exitLinks: [{fromId: nodeId}]
  };
}

function buildRoutineFlow(builder, block, startLabel, endLabel) {
  const startId = addFlowNode(builder, "terminal", startLabel);
  const endId = addFlowNode(builder, "terminal", endLabel);
  const bodySegment = buildStatementSequence(builder, block.getInputTargetBlock("BODY"));

  if (bodySegment) {
    addFlowEdge(builder, startId, bodySegment.entryId);
    connectFlowExits(builder, bodySegment.exitLinks, endId);
  } else {
    addFlowEdge(builder, startId, endId);
  }
}

function buildDetachedFlow(builder, block, index) {
  const startId = addFlowNode(builder, "terminal", `Workspace segment ${index}`);
  const endId = addFlowNode(builder, "terminal", `End segment ${index}`);
  const segment = buildStatementSequence(builder, block);

  if (segment) {
    addFlowEdge(builder, startId, segment.entryId);
    connectFlowExits(builder, segment.exitLinks, endId);
  } else {
    addFlowEdge(builder, startId, endId);
  }
}

function buildStatementSequence(builder, startBlock) {
  let entryId = "";
  let openExits = [];
  let block = startBlock;

  while (block) {
    const segment = buildStatementFlow(builder, block);

    if (segment) {
      if (!entryId) {
        entryId = segment.entryId;
      }

      if (openExits.length > 0) {
        connectFlowExits(builder, openExits, segment.entryId);
      }

      openExits = segment.exitLinks;
    }

    block = block.getNextBlock();
  }

  if (!entryId) {
    return null;
  }

  return {
    entryId,
    exitLinks: openExits
  };
}

function buildStatementFlow(builder, block) {
  switch (block.type) {
    case "pseudo_step":
      return createLinearSegment(builder, getFieldValue(block, "TEXT"), "process");

    case "pseudo_comment":
      return createLinearSegment(builder, `Comment: ${getFieldValue(block, "TEXT")}`, "comment");

    case "pseudo_declare":
      return createLinearSegment(
        builder,
        `DECLARE ${getFieldValue(block, "NAME")} AS ${getFieldValue(block, "DATA_TYPE")}`,
        "process"
      );

    case "pseudo_set":
      return createLinearSegment(
        builder,
        `SET ${getFieldValue(block, "NAME")} = ${getFieldValue(block, "EXPRESSION")}`,
        "process"
      );

    case "pseudo_input":
      return createLinearSegment(builder, `INPUT ${getFieldValue(block, "NAME")}`, "io");

    case "pseudo_output":
      return createLinearSegment(builder, `OUTPUT ${getFieldValue(block, "VALUE")}`, "io");

    case "pseudo_call":
      return createLinearSegment(
        builder,
        `CALL ${getFieldValue(block, "NAME")}(${getFieldValue(block, "ARGUMENTS")})`,
        "process"
      );

    case "pseudo_return":
      return createLinearSegment(builder, `RETURN ${getFieldValue(block, "VALUE")}`, "process");

    case "pseudo_if": {
      const decisionId = addFlowNode(builder, "decision", `IF ${getFieldValue(block, "CONDITION")}?`);
      const thenSegment = buildStatementSequence(builder, block.getInputTargetBlock("THEN"));
      const exitLinks = [];

      if (thenSegment) {
        addFlowEdge(builder, decisionId, thenSegment.entryId, "Yes");
        exitLinks.push(...thenSegment.exitLinks);
      } else {
        exitLinks.push({fromId: decisionId, label: "Yes"});
      }

      exitLinks.push({fromId: decisionId, label: "No"});

      return {
        entryId: decisionId,
        exitLinks
      };
    }

    case "pseudo_if_else": {
      const decisionId = addFlowNode(builder, "decision", `IF ${getFieldValue(block, "CONDITION")}?`);
      const thenSegment = buildStatementSequence(builder, block.getInputTargetBlock("THEN"));
      const elseSegment = buildStatementSequence(builder, block.getInputTargetBlock("ELSE"));
      const exitLinks = [];

      if (thenSegment) {
        addFlowEdge(builder, decisionId, thenSegment.entryId, "Yes");
        exitLinks.push(...thenSegment.exitLinks);
      } else {
        exitLinks.push({fromId: decisionId, label: "Yes"});
      }

      if (elseSegment) {
        addFlowEdge(builder, decisionId, elseSegment.entryId, "No");
        exitLinks.push(...elseSegment.exitLinks);
      } else {
        exitLinks.push({fromId: decisionId, label: "No"});
      }

      return {
        entryId: decisionId,
        exitLinks
      };
    }

    case "pseudo_while": {
      const decisionId = addFlowNode(builder, "decision", `WHILE ${getFieldValue(block, "CONDITION")}?`);
      const bodySegment = buildStatementSequence(builder, block.getInputTargetBlock("BODY"));

      if (bodySegment) {
        addFlowEdge(builder, decisionId, bodySegment.entryId, "Yes");
        connectFlowExits(builder, bodySegment.exitLinks, decisionId);
      } else {
        addFlowEdge(builder, decisionId, decisionId, "Yes");
      }

      return {
        entryId: decisionId,
        exitLinks: [{fromId: decisionId, label: "No"}]
      };
    }

    case "pseudo_for": {
      const counter = getFieldValue(block, "COUNTER");
      const start = getFieldValue(block, "START");
      const end = getFieldValue(block, "END");
      const step = getFieldValue(block, "STEP");
      const decisionId = addFlowNode(builder, "decision", `FOR ${counter} = ${start} TO ${end}${step ? ` STEP ${step}` : ""}`);
      const bodySegment = buildStatementSequence(builder, block.getInputTargetBlock("BODY"));

      if (bodySegment) {
        addFlowEdge(builder, decisionId, bodySegment.entryId, "Next");
        connectFlowExits(builder, bodySegment.exitLinks, decisionId);
      } else {
        addFlowEdge(builder, decisionId, decisionId, "Next");
      }

      return {
        entryId: decisionId,
        exitLinks: [{fromId: decisionId, label: "Done"}]
      };
    }

    case "pseudo_repeat_until": {
      const repeatId = addFlowNode(builder, "process", "REPEAT");
      const decisionId = addFlowNode(builder, "decision", `UNTIL ${getFieldValue(block, "CONDITION")}?`);
      const bodySegment = buildStatementSequence(builder, block.getInputTargetBlock("BODY"));

      if (bodySegment) {
        addFlowEdge(builder, repeatId, bodySegment.entryId);
        connectFlowExits(builder, bodySegment.exitLinks, decisionId);
      } else {
        addFlowEdge(builder, repeatId, decisionId);
      }

      addFlowEdge(builder, decisionId, repeatId, "No");

      return {
        entryId: repeatId,
        exitLinks: [{fromId: decisionId, label: "Yes"}]
      };
    }

    default:
      return createLinearSegment(builder, block.type, "process");
  }
}

function buildFlowchartText() {
  const topBlocks = getTopBlocks();
  if (topBlocks.length === 0) {
    return "";
  }

  const builder = createFlowchartBuilder();
  let detachedIndex = 0;

  topBlocks.forEach((block) => {
    if (block.type === "pseudo_program") {
      buildRoutineFlow(
        builder,
        block,
        `PROGRAM ${getFieldValue(block, "NAME")}`,
        "ENDPROGRAM"
      );
      return;
    }

    if (block.type === "pseudo_function") {
      buildRoutineFlow(
        builder,
        block,
        `FUNCTION ${getFieldValue(block, "NAME")}(${getFieldValue(block, "PARAMETERS")})`,
        "ENDFUNCTION"
      );
      return;
    }

    if (block.type === "pseudo_procedure") {
      buildRoutineFlow(
        builder,
        block,
        `PROCEDURE ${getFieldValue(block, "NAME")}(${getFieldValue(block, "PARAMETERS")})`,
        "ENDPROCEDURE"
      );
      return;
    }

    detachedIndex += 1;
    buildDetachedFlow(builder, block, detachedIndex);
  });

  const classAssignments = Object.entries(builder.classMembers)
    .filter(([, nodeIds]) => nodeIds.length > 0)
    .map(([className, nodeIds]) => `class ${nodeIds.join(",")} ${className};`);

  return [
    "flowchart TD",
    "classDef terminal fill:#e8f4ec,stroke:#29683a,stroke-width:2px,color:#152033;",
    "classDef process fill:#edf3ff,stroke:#2d5ecf,stroke-width:1.5px,color:#152033;",
    "classDef decision fill:#fff5da,stroke:#c06a1c,stroke-width:2px,color:#152033;",
    "classDef io fill:#f2ecff,stroke:#8956bc,stroke-width:1.5px,color:#152033;",
    "classDef comment fill:#f7f9fc,stroke:#92a0b8,stroke-width:1.5px,color:#425067;",
    ...builder.nodes,
    ...builder.edges,
    ...classAssignments
  ].join("\n");
}

function initializeMermaid() {
  if (mermaidConfigured) {
    return true;
  }

  if (!window.mermaid || typeof window.mermaid.initialize !== "function") {
    return false;
  }

  window.mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    themeVariables: {
      background: "#fbfcff",
      fontFamily: "Trebuchet MS, Segoe UI, sans-serif",
      primaryColor: "#edf3ff",
      primaryTextColor: "#152033",
      primaryBorderColor: "#2d5ecf",
      secondaryColor: "#f2ecff",
      tertiaryColor: "#fff5da",
      lineColor: "#51617e",
      clusterBkg: "#f8fbff",
      clusterBorder: "#d8dfef",
      edgeLabelBackground: "#ffffff"
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: false,
      curve: "basis"
    }
  });

  mermaidConfigured = true;
  return true;
}

function renderDiagramPlaceholder(message) {
  dom.diagramPreview.innerHTML = `<p class="empty-preview-note">${escapeHtml(message)}</p>`;
}

function clampDiagramPanelHeight(height) {
  if (!dom.previewStack) {
    return Math.round(Math.max(MIN_DIAGRAM_PANEL_HEIGHT, height || DEFAULT_DIAGRAM_PANEL_HEIGHT));
  }

  const stackRect = dom.previewStack.getBoundingClientRect();
  const dividerHeight = dom.previewDivider ? dom.previewDivider.getBoundingClientRect().height : 0;
  const proposedHeight = Number.isFinite(height) ? height : DEFAULT_DIAGRAM_PANEL_HEIGHT;

  if (stackRect.height <= 0) {
    return Math.round(Math.max(MIN_DIAGRAM_PANEL_HEIGHT, proposedHeight));
  }

  const maxFromLayout = Math.max(
    MIN_DIAGRAM_PANEL_HEIGHT,
    stackRect.height - dividerHeight - MIN_PSEUDOCODE_PANEL_HEIGHT
  );

  return Math.round(
    Math.min(maxFromLayout, Math.max(MIN_DIAGRAM_PANEL_HEIGHT, proposedHeight))
  );
}

function applyDiagramPanelHeight(height, persist = true) {
  const clampedHeight = clampDiagramPanelHeight(height);
  document.documentElement.style.setProperty("--diagram-panel-height", `${clampedHeight}px`);

  if (persist) {
    try {
      localStorage.setItem(PREVIEW_SPLIT_STORAGE_KEY, String(clampedHeight));
    } catch (error) {
      // Ignore layout persistence failures.
    }
  }
}

function restoreDiagramPanelHeight() {
  let preferredHeight = DEFAULT_DIAGRAM_PANEL_HEIGHT;

  try {
    const savedHeight = Number(localStorage.getItem(PREVIEW_SPLIT_STORAGE_KEY));
    if (Number.isFinite(savedHeight)) {
      preferredHeight = savedHeight;
    }
  } catch (error) {
    // Ignore layout persistence failures.
  }

  applyDiagramPanelHeight(preferredHeight, false);
}

function getCurrentDiagramPanelHeight() {
  return Math.round(
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--diagram-panel-height")) ||
      DEFAULT_DIAGRAM_PANEL_HEIGHT
  );
}

function updatePreviewDividerAriaValues() {
  if (!dom.previewDivider) {
    return;
  }

  const stackRect = dom.previewStack ? dom.previewStack.getBoundingClientRect() : {height: 0};
  const dividerHeight = dom.previewDivider.getBoundingClientRect().height;
  const maxFromLayout = stackRect.height > 0
    ? Math.max(MIN_DIAGRAM_PANEL_HEIGHT, stackRect.height - dividerHeight - MIN_PSEUDOCODE_PANEL_HEIGHT)
    : DEFAULT_DIAGRAM_PANEL_HEIGHT;

  dom.previewDivider.setAttribute("aria-valuemin", String(MIN_DIAGRAM_PANEL_HEIGHT));
  dom.previewDivider.setAttribute("aria-valuemax", String(Math.round(maxFromLayout)));
  dom.previewDivider.setAttribute("aria-valuenow", String(getCurrentDiagramPanelHeight()));
}

function applyDiagramFitMode(enabled, persist = true) {
  diagramFitEnabled = Boolean(enabled);

  if (dom.diagramPreview) {
    dom.diagramPreview.dataset.fitMode = diagramFitEnabled ? "panel" : "free";
  }

  if (dom.fitDiagramBtn) {
    dom.fitDiagramBtn.textContent = diagramFitEnabled ? "Fit: On" : "Fit: Off";
    dom.fitDiagramBtn.setAttribute("aria-pressed", String(diagramFitEnabled));
  }

  if (persist) {
    try {
      localStorage.setItem(DIAGRAM_FIT_STORAGE_KEY, diagramFitEnabled ? "on" : "off");
    } catch (error) {
      // Ignore layout persistence failures.
    }
  }
}

function restoreDiagramFitMode() {
  let preferredMode = true;

  try {
    preferredMode = localStorage.getItem(DIAGRAM_FIT_STORAGE_KEY) !== "off";
  } catch (error) {
    // Ignore layout persistence failures.
  }

  applyDiagramFitMode(preferredMode, false);
}

function clampPreviewPanelWidth(width) {
  const layoutRect = dom.appLayout.getBoundingClientRect();
  const dividerWidth = dom.layoutDivider ? dom.layoutDivider.getBoundingClientRect().width : 0;
  const maxFromLayout = Math.max(
    MIN_PREVIEW_PANEL_WIDTH,
    layoutRect.width - MIN_WORKSPACE_PANEL_WIDTH - dividerWidth
  );

  return Math.round(
    Math.min(
      maxFromLayout,
      Math.max(MIN_PREVIEW_PANEL_WIDTH, Math.min(MAX_PREVIEW_PANEL_WIDTH, width))
    )
  );
}

function applyPreviewPanelWidth(width, persist = true) {
  const clampedWidth = clampPreviewPanelWidth(width);
  document.documentElement.style.setProperty("--preview-panel-width", `${clampedWidth}px`);

  if (persist) {
    try {
      localStorage.setItem(LAYOUT_SPLIT_STORAGE_KEY, String(clampedWidth));
    } catch (error) {
      // Ignore layout persistence failures.
    }
  }

  resizeWorkspaceSurface();
}

function restorePreviewPanelWidth() {
  let preferredWidth = DEFAULT_PREVIEW_PANEL_WIDTH;

  try {
    const savedWidth = Number(localStorage.getItem(LAYOUT_SPLIT_STORAGE_KEY));
    if (Number.isFinite(savedWidth)) {
      preferredWidth = savedWidth;
    }
  } catch (error) {
    // Ignore layout persistence failures.
  }

  applyPreviewPanelWidth(preferredWidth, false);
}

function updateDividerAriaValues() {
  if (!dom.layoutDivider) {
    return;
  }

  const currentWidth = Math.round(
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--preview-panel-width")) ||
      DEFAULT_PREVIEW_PANEL_WIDTH
  );

  dom.layoutDivider.setAttribute("aria-valuemin", String(MIN_PREVIEW_PANEL_WIDTH));
  dom.layoutDivider.setAttribute("aria-valuemax", String(MAX_PREVIEW_PANEL_WIDTH));
  dom.layoutDivider.setAttribute("aria-valuenow", String(currentWidth));
}

function endDividerDrag() {
  if (!layoutDividerDragState) {
    return;
  }

  if (document.body.dataset.isResizing === "layout") {
    delete document.body.dataset.isResizing;
  }

  layoutDividerDragState = null;
}

function setPreviewWidthFromPointer(clientX) {
  const layoutRect = dom.appLayout.getBoundingClientRect();
  const nextWidth = layoutRect.right - clientX;

  applyPreviewPanelWidth(nextWidth);
  updateDividerAriaValues();
}

function handleDividerPointerMove(event) {
  if (!layoutDividerDragState) {
    return;
  }

  setPreviewWidthFromPointer(event.clientX);
}

function handleDividerPointerUp() {
  endDividerDrag();
}

function handleDividerPointerDown(event) {
  if (desktopLayoutMedia.matches) {
    return;
  }

  layoutDividerDragState = {pointerId: event.pointerId};
  document.body.dataset.isResizing = "layout";
  dom.layoutDivider.setPointerCapture(event.pointerId);
  setPreviewWidthFromPointer(event.clientX);
}

function handleDividerKeyDown(event) {
  if (desktopLayoutMedia.matches) {
    return;
  }

  const currentWidth = Math.round(
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--preview-panel-width")) ||
      DEFAULT_PREVIEW_PANEL_WIDTH
  );

  let nextWidth = currentWidth;

  if (event.key === "ArrowLeft") {
    nextWidth = currentWidth + 24;
  } else if (event.key === "ArrowRight") {
    nextWidth = currentWidth - 24;
  } else if (event.key === "Home") {
    nextWidth = MIN_PREVIEW_PANEL_WIDTH;
  } else if (event.key === "End") {
    nextWidth = MAX_PREVIEW_PANEL_WIDTH;
  } else {
    return;
  }

  event.preventDefault();
  applyPreviewPanelWidth(nextWidth);
  updateDividerAriaValues();
}

function endPreviewDividerDrag() {
  if (!previewDividerDragState) {
    return;
  }

  if (document.body.dataset.isResizing === "preview") {
    delete document.body.dataset.isResizing;
  }

  previewDividerDragState = null;
}

function setDiagramHeightFromPointer(clientY) {
  if (!dom.previewStack) {
    return;
  }

  const stackRect = dom.previewStack.getBoundingClientRect();
  const nextHeight = clientY - stackRect.top;

  applyDiagramPanelHeight(nextHeight);
  updatePreviewDividerAriaValues();
}

function handlePreviewDividerPointerMove(event) {
  if (!previewDividerDragState) {
    return;
  }

  setDiagramHeightFromPointer(event.clientY);
}

function handlePreviewDividerPointerUp() {
  endPreviewDividerDrag();
}

function handlePreviewDividerPointerDown(event) {
  if (!dom.previewDivider || !dom.previewStack) {
    return;
  }

  previewDividerDragState = {pointerId: event.pointerId};
  document.body.dataset.isResizing = "preview";
  dom.previewDivider.setPointerCapture(event.pointerId);
  setDiagramHeightFromPointer(event.clientY);
}

function handlePreviewDividerKeyDown(event) {
  const currentHeight = getCurrentDiagramPanelHeight();
  let nextHeight = currentHeight;

  if (event.key === "ArrowUp") {
    nextHeight = currentHeight - 24;
  } else if (event.key === "ArrowDown") {
    nextHeight = currentHeight + 24;
  } else if (event.key === "Home") {
    nextHeight = MIN_DIAGRAM_PANEL_HEIGHT;
  } else if (event.key === "End") {
    nextHeight = Number(dom.previewDivider.getAttribute("aria-valuemax")) || DEFAULT_DIAGRAM_PANEL_HEIGHT;
  } else {
    return;
  }

  event.preventDefault();
  applyDiagramPanelHeight(nextHeight);
  updatePreviewDividerAriaValues();
}

async function renderFlowchartPreview() {
  const flowchartText = buildFlowchartText();
  const renderToken = ++mermaidRenderToken;
  latestFlowchartText = flowchartText;

  if (!flowchartText) {
    latestRenderedDiagramSvg = "";
    renderDiagramPlaceholder(EMPTY_FLOWCHART_MESSAGE);
    updateDiagramStatus("Waiting for blocks", "neutral");
    return;
  }

  if (!initializeMermaid()) {
    renderDiagramPlaceholder("Local Mermaid preview is unavailable.");
    updateDiagramStatus("Diagram library unavailable", "warning");
    return;
  }

  try {
    if (typeof window.mermaid.parse === "function") {
      await window.mermaid.parse(flowchartText);
    }

    const renderResult = await window.mermaid.render(`flowchart-preview-${renderToken}`, flowchartText);
    const svg = typeof renderResult === "string" ? renderResult : renderResult.svg;
    const bindFunctions = renderResult && typeof renderResult === "object" ? renderResult.bindFunctions : null;

    if (renderToken !== mermaidRenderToken) {
      return;
    }

    latestRenderedDiagramSvg = svg;
    dom.diagramPreview.innerHTML = svg;
    const renderedSvg = dom.diagramPreview.querySelector("svg");
    if (renderedSvg) {
      renderedSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
    if (typeof bindFunctions === "function") {
      bindFunctions(dom.diagramPreview);
    }

    updateDiagramStatus("Flow diagram updated", "good");
  } catch (error) {
    if (renderToken !== mermaidRenderToken) {
      return;
    }

    latestRenderedDiagramSvg = "";
    renderDiagramPlaceholder("Flow diagram could not be generated from the current blocks.");
    updateDiagramStatus("Diagram render failed", "warning");
  }
}

function updateWorkspaceSummary() {
  const count = countAllBlocks();
  dom.workspaceSummary.textContent = `${count} block${count === 1 ? "" : "s"} in workspace`;
  dom.copyOutputBtn.disabled = count === 0;
  dom.copyDiagramBtn.disabled = count === 0;
  dom.fitDiagramBtn.disabled = count === 0;
  dom.clearWorkspaceBtn.disabled = count === 0;
}

function updateValidationState() {
  const programCount = getProgramBlocks().length;

  if (programCount === 0) {
    updateValidationBanner("Not ready", "warning");
    return;
  }

  if (programCount > 1) {
    updateValidationBanner("Not ready", "warning");
    return;
  }

  updateValidationBanner("Ready", "good");
}

function renderDerivedState() {
  dom.outputPreview.textContent = buildPreviewText();
  void renderFlowchartPreview();
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

function copyTextFallback(text) {
  if (typeof document.execCommand !== "function") {
    return false;
  }

  const textarea = document.createElement("textarea");
  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);

    if (selection) {
      selection.removeAllRanges();
      if (previousRange) {
        selection.addRange(previousRange);
      }
    }
  }
}

async function copyPreviewToClipboard() {
  try {
    const text = dom.outputPreview.textContent;

    if (window.isSecureContext && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
    } else if (!copyTextFallback(text)) {
      throw new Error("Clipboard unavailable");
    }

    updateSaveStatus("Copied pseudocode", "good");
  } catch (error) {
    updateSaveStatus("Copy failed", "warning");
  }

  resetStatusLater();
}

function parseSvgViewBox(rawViewBox) {
  const values = String(rawViewBox || "")
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number(value));

  if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
    return null;
  }

  return {
    minX: values[0],
    minY: values[1],
    width: values[2],
    height: values[3]
  };
}

function getDiagramExportSpec() {
  const renderedSvg = dom.diagramPreview.querySelector("svg");
  if (!renderedSvg) {
    return null;
  }

  const clone = renderedSvg.cloneNode(true);
  const viewBox = parseSvgViewBox(clone.getAttribute("viewBox"));
  const widthAttr = Number.parseFloat(clone.getAttribute("width"));
  const heightAttr = Number.parseFloat(clone.getAttribute("height"));
  const rect = renderedSvg.getBoundingClientRect();
  const width = Math.max(
    1,
    Math.round(
      viewBox && viewBox.width > 0
        ? viewBox.width
        : Number.isFinite(widthAttr) && widthAttr > 0
          ? widthAttr
          : rect.width
    )
  );
  const height = Math.max(
    1,
    Math.round(
      viewBox && viewBox.height > 0
        ? viewBox.height
        : Number.isFinite(heightAttr) && heightAttr > 0
          ? heightAttr
          : rect.height
    )
  );

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("style", "background:#fbfcff;");
  clone.removeAttribute("class");

  return {
    markup: new XMLSerializer().serializeToString(clone),
    width,
    height
  };
}

async function exportDiagramPngBlob() {
  const exportSpec = getDiagramExportSpec();
  if (!exportSpec) {
    throw new Error("Diagram unavailable");
  }

  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas unavailable");
  }

  canvas.width = Math.max(1, exportSpec.width * scale);
  canvas.height = Math.max(1, exportSpec.height * scale);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, exportSpec.width, exportSpec.height);
  context.fillStyle = "#fbfcff";
  context.fillRect(0, 0, exportSpec.width, exportSpec.height);

  const svgBlob = new Blob([exportSpec.markup], {type: "image/svg+xml;charset=utf-8"});
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("SVG rasterization failed"));
      nextImage.src = objectUrl;
    });

    context.drawImage(image, 0, 0, exportSpec.width, exportSpec.height);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("PNG export failed"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function restoreSelection(selection, previousRanges) {
  if (!selection) {
    return;
  }

  selection.removeAllRanges();
  previousRanges.forEach((range) => {
    selection.addRange(range);
  });
}

async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Data URL conversion failed"));
    reader.readAsDataURL(blob);
  });
}

function copyImageElementFallback(dataUrl, width, height) {
  if (typeof document.execCommand !== "function") {
    return false;
  }

  const selection = document.getSelection();
  const previousRanges = selection
    ? Array.from({length: selection.rangeCount}, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  const wrapper = document.createElement("div");
  const image = document.createElement("img");

  wrapper.contentEditable = "true";
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "-9999px";
  wrapper.style.opacity = "0";
  wrapper.style.pointerEvents = "none";
  wrapper.style.userSelect = "text";

  image.src = dataUrl;
  image.alt = "Flow diagram";
  image.width = Math.max(1, Math.round(width));
  image.height = Math.max(1, Math.round(height));
  wrapper.appendChild(image);
  document.body.appendChild(wrapper);

  try {
    const copyHandler = (event) => {
      if (!event.clipboardData) {
        return;
      }

      event.clipboardData.setData("text/html", wrapper.innerHTML);
      event.clipboardData.setData("text/plain", "Flow diagram image");
      event.preventDefault();
    };
    const range = document.createRange();
    range.selectNode(image);

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    document.addEventListener("copy", copyHandler);
    wrapper.focus();
    try {
      return document.execCommand("copy");
    } finally {
      document.removeEventListener("copy", copyHandler);
    }
  } finally {
    document.body.removeChild(wrapper);
    restoreSelection(selection, previousRanges);
  }
}

async function copyFlowDiagramToClipboard() {
  if (!latestFlowchartText) {
    updateSaveStatus("No flow diagram to copy", "warning");
    resetStatusLater();
    return;
  }

  try {
    const exportSpec = getDiagramExportSpec();
    if (!exportSpec) {
      throw new Error("Diagram unavailable");
    }

    const pngBlob = await exportDiagramPngBlob();
    let copied = false;

    if (
      window.isSecureContext &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === "function" &&
      typeof window.ClipboardItem === "function"
    ) {
      try {
        await navigator.clipboard.write([
          new window.ClipboardItem({
            "image/png": pngBlob
          })
        ]);
        copied = true;
      } catch (error) {
        copied = false;
      }
    }

    if (!copied) {
      const dataUrl = await blobToDataUrl(pngBlob);
      copied = copyImageElementFallback(dataUrl, exportSpec.width, exportSpec.height);
    }

    if (!copied) {
      throw new Error("Clipboard image copy unavailable");
    }

    updateSaveStatus("Copied flow diagram image", "good");
  } catch (error) {
    updateSaveStatus("Image copy failed", "warning");
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
    if (!desktopLayoutMedia.matches) {
      restorePreviewPanelWidth();
      updateDividerAriaValues();
    }

    restoreDiagramPanelHeight();
    updatePreviewDividerAriaValues();
    resizeWorkspaceSurface();
  });
}

function wireLayoutDivider() {
  if (!dom.layoutDivider) {
    return;
  }

  dom.layoutDivider.addEventListener("pointerdown", handleDividerPointerDown);
  dom.layoutDivider.addEventListener("pointermove", handleDividerPointerMove);
  dom.layoutDivider.addEventListener("pointerup", handleDividerPointerUp);
  dom.layoutDivider.addEventListener("pointercancel", handleDividerPointerUp);
  dom.layoutDivider.addEventListener("keydown", handleDividerKeyDown);

  desktopLayoutMedia.addEventListener("change", () => {
    endDividerDrag();
    endPreviewDividerDrag();

    if (!desktopLayoutMedia.matches) {
      restorePreviewPanelWidth();
      updateDividerAriaValues();
    }

    restoreDiagramPanelHeight();
    updatePreviewDividerAriaValues();
  });
}

function wirePreviewDivider() {
  if (!dom.previewDivider) {
    return;
  }

  dom.previewDivider.addEventListener("pointerdown", handlePreviewDividerPointerDown);
  dom.previewDivider.addEventListener("pointermove", handlePreviewDividerPointerMove);
  dom.previewDivider.addEventListener("pointerup", handlePreviewDividerPointerUp);
  dom.previewDivider.addEventListener("pointercancel", handlePreviewDividerPointerUp);
  dom.previewDivider.addEventListener("keydown", handlePreviewDividerKeyDown);
}

function wireUi() {
  dom.copyOutputBtn.addEventListener("click", () => {
    copyPreviewToClipboard();
  });

  dom.fitDiagramBtn.addEventListener("click", () => {
    applyDiagramFitMode(!diagramFitEnabled);
  });

  dom.copyDiagramBtn.addEventListener("click", () => {
    copyFlowDiagramToClipboard();
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
  initializeMermaid();
  restorePreviewPanelWidth();
  restoreDiagramPanelHeight();
  restoreDiagramFitMode();
  updateDividerAriaValues();
  updatePreviewDividerAriaValues();
  injectWorkspace();
  wireLayoutDivider();
  wirePreviewDivider();
  wireUi();
  renderDerivedState();

  const restoredAutosave = restoreAutosave();
  if (!restoredAutosave) {
    renderDerivedState();
  }
}

initializeApp();
