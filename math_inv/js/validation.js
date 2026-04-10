export const SECTION_ORDER = [
  "setup",
  "introduction",
  "investigation",
  "data",
  "graphs",
  "analysis",
  "conclusion",
  "export",
];

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function rowHasText(row, keys) {
  return keys.every((key) => hasText(row?.[key]));
}

function hasRowValues(row) {
  return Array.isArray(row) && row.some((cell) => hasText(String(cell ?? "")));
}

function validateSetup(state) {
  const required = [
    hasText(state.setup.title),
    hasText(state.setup.subject),
    hasText(state.setup.yearLevel),
    hasText(state.setup.teacher),
    hasText(state.setup.className),
    hasText(state.setup.dueDate),
    hasText(state.setup.taskType),
    hasText(state.setup.problemFocus),
  ];

  return {
    complete: required.every(Boolean),
    warnings: required.every(Boolean)
      ? []
      : ["Complete the setup details before final export."],
  };
}

function validateIntroduction(state) {
  const complete =
    hasText(state.introduction.hook) &&
    hasText(state.introduction.problemContext) &&
    hasText(state.introduction.fieldOfMathematics) &&
    hasText(state.introduction.fieldDescription) &&
    hasText(state.introduction.connection);

  return {
    complete,
    warnings: complete
      ? []
      : ["Complete the hook, problem context, mathematics field, field description, and connection."],
  };
}

function validateInvestigation(state) {
  const validCycles = (state.investigation.cycles ?? []).filter((cycle) =>
    rowHasText(cycle, ["heading", "introduce", "workings", "explanation"]),
  );

  return {
    complete: validCycles.length > 0,
    warnings:
      validCycles.length > 0
        ? []
        : ["Add at least one complete investigation cycle with heading, introduction, workings, and explanation."],
  };
}

function validateData(state) {
  const columnsValid = (state.data.columns ?? []).length >= 2;
  const rowsValid = (state.data.rows ?? []).some((row) => hasRowValues(row));

  const warnings = [];
  if (!columnsValid) {
    warnings.push("Add at least two data columns.");
  }
  if (!rowsValid) {
    warnings.push("Enter at least one row of data values.");
  }

  return {
    complete: columnsValid && rowsValid,
    warnings,
  };
}

function validateGraphs(state) {
  const graphCards = state.graphs?.cards ?? [];
  const hasGraph = graphCards.some(
    (graph) =>
      Number.isFinite(Number.parseInt(graph?.xColumn, 10)) &&
      Array.isArray(graph?.yColumns) &&
      graph.yColumns.length > 0,
  );

  const complete = hasGraph && hasText(state.graphs.commentary);

  return {
    complete,
    warnings: complete
      ? []
      : ["Configure at least one graph and describe what the graph(s) show."],
  };
}

function validateAnalysis(state) {
  const narrativeComplete =
    hasText(state.analysis.patternOfResults) &&
    hasText(state.analysis.writtenEvidence) &&
    hasText(state.analysis.assumptions) &&
    hasText(state.analysis.reasonableness);

  const strengthsValid = (state.analysis.strengths ?? []).some((row) =>
    rowHasText(row, ["factor", "impact"]),
  );
  const limitationsValid = (state.analysis.limitations ?? []).some((row) =>
    rowHasText(row, ["factor", "impact"]),
  );
  const improvementsValid = (state.analysis.improvements ?? []).some((row) =>
    rowHasText(row, ["improvement", "benefit"]),
  );

  const warnings = [];
  if (!narrativeComplete) {
    warnings.push("Complete the pattern, written evidence, assumptions, and reasonableness analysis.");
  }
  if (!strengthsValid) {
    warnings.push("Add at least one complete strength paragraph prompt.");
  }
  if (!limitationsValid) {
    warnings.push("Add at least one complete limitation paragraph prompt.");
  }
  if (!improvementsValid) {
    warnings.push("Add at least one complete improvement paragraph prompt.");
  }

  return {
    complete: narrativeComplete && strengthsValid && limitationsValid && improvementsValid,
    warnings,
  };
}

function validateConclusion(state) {
  const complete =
    hasText(state.conclusion.relationBack) &&
    hasText(state.conclusion.majorFindings) &&
    hasText(state.conclusion.solutionStatement);

  return {
    complete,
    warnings: complete
      ? []
      : ["Complete the conclusion by linking back to the mathematics, summarising findings, and stating the final solution."],
  };
}

function validateExport(state) {
  const map = {
    setup: validateSetup(state).complete,
    introduction: validateIntroduction(state).complete,
    investigation: validateInvestigation(state).complete,
    data: validateData(state).complete,
    graphs: validateGraphs(state).complete,
    analysis: validateAnalysis(state).complete,
    conclusion: validateConclusion(state).complete,
  };

  const incompleteCount = Object.values(map).filter((isComplete) => !isComplete).length;

  return {
    complete: incompleteCount === 0,
    warnings:
      incompleteCount === 0
        ? []
        : [`${incompleteCount} section(s) still need attention before final submission.`],
  };
}

export function validateSection(sectionId, state) {
  const validators = {
    setup: validateSetup,
    introduction: validateIntroduction,
    investigation: validateInvestigation,
    data: validateData,
    graphs: validateGraphs,
    analysis: validateAnalysis,
    conclusion: validateConclusion,
    export: validateExport,
  };

  const validator = validators[sectionId];
  return validator ? validator(state) : { complete: true, warnings: [] };
}

export function validateAllSections(state) {
  return SECTION_ORDER.reduce((result, sectionId) => {
    result[sectionId] = validateSection(sectionId, state);
    return result;
  }, {});
}
