export const SECTION_ORDER = [
  "setup",
  "question",
  "hypothesis",
  "variables",
  "risks",
  "materials",
  "method",
  "data",
  "analysis",
  "evaluation",
  "conclusion",
  "export",
];

// Teacher-editable phrase lists for the research question heuristic.
export const QUESTION_STARTERS = [
  "how does",
  "how do",
  "what is the effect of",
  "which",
  "to what extent",
];

export const RELATIONSHIP_WORDS = [
  "affect",
  "effect",
  "influence",
  "change",
  "increase",
  "decrease",
  "compare",
];

export const MEASURABLE_TERMS = [
  "time",
  "distance",
  "speed",
  "acceleration",
  "rate",
  "mass",
  "volume",
  "temperature",
  "ph",
  "force",
  "energy",
  "voltage",
  "current",
  "resistance",
  "height",
  "length",
  "frequency",
  "concentration",
];

export const VAGUE_WORDS = [
  "thing",
  "things",
  "stuff",
  "better",
  "worse",
  "good",
  "bad",
  "more",
  "less",
];

const COMPARATIVE_CONTEXT_TERMS = new Set([
  ...MEASURABLE_TERMS,
  "amount",
  "number",
  "level",
  "value",
]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasRowValues(row) {
  return Array.isArray(row) && row.some((cell) => hasText(String(cell ?? "")));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesWord(text, word) {
  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
  return pattern.test(text);
}

function includesAnyWord(text, words) {
  return words.some((word) => includesWord(text, word));
}

function uniqueMessages(items) {
  return Array.from(new Set(items));
}

function isComparativeVagueUsage(textLower, word) {
  const pattern = new RegExp(`\\b${word}\\b`, "g");
  let match;

  while ((match = pattern.exec(textLower)) !== null) {
    const after = textLower
      .slice(match.index + word.length)
      .trimStart()
      .split(/\s+/)
      .slice(0, 2)
      .map((token) => token.replace(/[^a-z0-9]/g, ""));

    const isTiedToMeasuredTerm = after.some((token) => COMPARATIVE_CONTEXT_TERMS.has(token));
    if (!isTiedToMeasuredTerm) {
      return true;
    }
  }

  return false;
}

function detectVagueWords(textLower) {
  const found = [];

  VAGUE_WORDS.forEach((word) => {
    if (word === "more" || word === "less") {
      if (isComparativeVagueUsage(textLower, word)) {
        found.push(word);
      }
      return;
    }

    if (includesWord(textLower, word)) {
      found.push(word);
    }
  });

  return {
    found,
    count: found.length,
  };
}

function hasScientificStarter(textLower) {
  return QUESTION_STARTERS.some((starter) => textLower.startsWith(starter));
}

function hasRelationshipStructure(textLower) {
  const howDoesPattern =
    /\bhow\s+(does|do)\b[\s\S]{2,120}\b(affect|effect|influence|change|increase|decrease|compare)\b[\s\S]{2,120}/i;
  const effectOfPattern =
    /\bwhat\s+is\s+the\s+effect\s+of\b[\s\S]{2,120}\bon\b[\s\S]{2,120}/i;
  const extentPattern =
    /\bto\s+what\s+extent\b[\s\S]{2,120}\b(affect|influence|change|increase|decrease|compare)\b[\s\S]{2,120}/i;

  return howDoesPattern.test(textLower) || effectOfPattern.test(textLower) || extentPattern.test(textLower);
}

// Transparent score-based validator for school science research questions.
export function validateResearchQuestion(questionText) {
  const raw = String(questionText ?? "").trim();

  if (!raw) {
    return {
      score: 0,
      level: "blank",
      warnings: [
        "Research question is blank.",
        "This question may be too vague. Try naming what you will change and what you will measure.",
      ],
      positives: [],
    };
  }

  const textLower = raw.toLowerCase();
  let score = 0;
  const warnings = [];
  const positives = [];

  if (raw.length >= 20) {
    score += 1;
  } else {
    warnings.push("Question may be too short to be specific.");
  }

  if (raw.length >= 35) {
    score += 1;
  }

  if (hasScientificStarter(textLower)) {
    score += 1;
    positives.push("Clear scientific question structure detected.");
  } else {
    warnings.push("Start with a clearer scientific structure, such as 'How does...'");
  }

  if (includesAnyWord(textLower, RELATIONSHIP_WORDS)) {
    score += 1;
    positives.push("Question includes relationship wording.");
  } else {
    warnings.push("Use wording that shows a relationship, such as 'affect' or 'influence'.");
  }

  if (includesAnyWord(textLower, MEASURABLE_TERMS)) {
    score += 2;
    positives.push("Measurable outcome detected.");
  } else {
    warnings.push("Include a measurable outcome such as time, mass, temperature, or distance.");
  }

  if (hasRelationshipStructure(textLower)) {
    score += 2;
    positives.push("How does X affect Y style structure detected.");
  } else {
    warnings.push("Try writing the question in the form 'How does X affect Y?'");
  }

  const vagueWords = detectVagueWords(textLower);
  if (vagueWords.count > 0) {
    score -= vagueWords.count;
    warnings.push(
      `Avoid vague words like '${vagueWords.found.join("', '")}' without saying what is measured.`,
    );
  }

  let level = "good";
  if (score < 4) {
    level = "too-vague";
  } else if (score <= 5) {
    level = "needs-improvement";
  }

  if (level === "too-vague") {
    warnings.push(
      "This question may be too vague. Try naming what you will change and what you will measure.",
    );
  }

  return {
    score,
    level,
    warnings: uniqueMessages(warnings),
    positives: uniqueMessages(positives),
  };
}

function validateSetup(state) {
  const required = [
    hasText(state.setup.title),
    hasText(state.setup.subject),
    hasText(state.setup.yearLevel),
    hasText(state.setup.teacher),
    hasText(state.setup.className),
    hasText(state.setup.dueDate),
    hasText(state.setup.investigationType),
  ];

  return {
    complete: required.every(Boolean),
    warnings: required.every(Boolean)
      ? []
      : ["Fill in all setup details before final export."],
  };
}

function validateQuestion(state) {
  const result = validateResearchQuestion(state.question.text);

  return {
    complete: result.level === "good" || result.level === "needs-improvement",
    warnings: result.warnings,
  };
}

function validateHypothesis(state) {
  const complete = hasText(state.hypothesis.statement) && hasText(state.hypothesis.reasoning);
  return {
    complete,
    warnings: complete ? [] : ["Complete both hypothesis and scientific reasoning."],
  };
}

function validateVariables(state) {
  const baseComplete = hasText(state.variables.independent) && hasText(state.variables.dependent);
  const controlledRows = state.variables.controlled ?? [];

  const controlledValid =
    controlledRows.length > 0 &&
    controlledRows.every(
      (row) => hasText(row.name) && hasText(row.reason) && hasText(row.controlMethod),
    );

  const warnings = [];
  if (!baseComplete) {
    warnings.push("Independent and dependent variables are required.");
  }
  if (!controlledValid) {
    warnings.push("Each controlled variable needs name, reason, and control method.");
  }

  return {
    complete: baseComplete && controlledValid,
    warnings,
  };
}

function validateRisks(state) {
  const validRows = (state.risks ?? []).filter(
    (row) => hasText(row.hazard) && hasText(row.risk) && hasText(row.precaution),
  );

  return {
    complete: validRows.length > 0,
    warnings: validRows.length > 0 ? [] : ["Add at least one complete risk row."],
  };
}

function validateMaterials(state) {
  const validRows = (state.materials ?? []).filter((row) => hasText(row.item));
  return {
    complete: validRows.length > 0,
    warnings: validRows.length > 0 ? [] : ["Add at least one material item."],
  };
}

function validateMethod(state) {
  const steps = (state.method.steps ?? []).filter((step) => hasText(step));
  return {
    complete: steps.length >= 2,
    warnings: steps.length >= 2 ? [] : ["Add at least two clear method steps."],
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

function validateAnalysis(state) {
  const complete =
    hasText(state.analysis.trend) &&
    hasText(state.analysis.anomalies) &&
    hasText(state.analysis.hypothesisSupported);

  return {
    complete,
    warnings: complete
      ? []
      : ["Complete trend, anomalies, and hypothesis support reflections."],
  };
}

function validateEvaluation(state) {
  const complete =
    hasText(state.evaluation.validity) &&
    hasText(state.evaluation.reliability) &&
    hasText(state.evaluation.limitations) &&
    hasText(state.evaluation.improvements);

  return {
    complete,
    warnings: complete
      ? []
      : ["Complete validity, reliability, limitations, and improvements."],
  };
}

function validateConclusion(state) {
  const complete =
    hasText(state.conclusion.claim) &&
    hasText(state.conclusion.evidence) &&
    hasText(state.conclusion.reasoning);

  return {
    complete,
    warnings: complete ? [] : ["Complete claim, evidence, and reasoning."],
  };
}

function validateExport(state) {
  const map = {
    setup: validateSetup(state).complete,
    question: validateQuestion(state).complete,
    hypothesis: validateHypothesis(state).complete,
    variables: validateVariables(state).complete,
    risks: validateRisks(state).complete,
    materials: validateMaterials(state).complete,
    method: validateMethod(state).complete,
    data: validateData(state).complete,
    analysis: validateAnalysis(state).complete,
    evaluation: validateEvaluation(state).complete,
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
    question: validateQuestion,
    hypothesis: validateHypothesis,
    variables: validateVariables,
    risks: validateRisks,
    materials: validateMaterials,
    method: validateMethod,
    data: validateData,
    analysis: validateAnalysis,
    evaluation: validateEvaluation,
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
