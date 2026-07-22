const SPEAKER_LABEL_PATTERN = /^(Host|Speaker)\s*([12])\s*:\s*(.*)$/i;
const TONE_TAG_PATTERN = /(\((?:curious|thoughtful|excited|surprised|serious|pause|laughs)\)|\[(?:warmly|thoughtful|pause|serious)\])/gi;
const PAUSE_TAG_PATTERN = /(\(\s*pause\s*\)|\[\s*pause\s*\])/i;
const CHEMICAL_FORMULA_PATTERN = /(^|[^A-Za-z])((?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d*)+)(?=$|[^A-Za-z])/g;
const ELEMENT_SYMBOLS = new Set([
  "H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne",
  "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar", "K", "Ca",
  "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
  "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
  "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn",
  "Sb", "Te", "I", "Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd",
  "Pm", "Sm", "Eu", "Gd", "Tb", "Dy", "Ho", "Er", "Tm", "Yb",
  "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
  "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th",
  "Pa", "U", "Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm",
  "Md", "No", "Lr", "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds",
  "Rg", "Cn", "Nh", "Fl", "Mc", "Lv", "Ts", "Og",
]);
const AMBIGUOUS_STANDALONE_SYMBOLS = new Set(["I", "In", "As", "At", "He", "Be", "No", "Am"]);
const NUMBER_WORDS = {
  0: "zero",
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
  13: "thirteen",
  14: "fourteen",
  15: "fifteen",
  16: "sixteen",
  17: "seventeen",
  18: "eighteen",
  19: "nineteen",
  20: "twenty",
};

export function parseTranscript(transcriptText) {
  const turns = [];
  const lines = transcriptText.split(/\r?\n/);
  let currentTurn = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (currentTurn) {
        currentTurn.hasPauseTag = true;
      }
      continue;
    }

    const speakerMatch = line.match(SPEAKER_LABEL_PATTERN);

    if (speakerMatch) {
      if (currentTurn) {
        turns.push(finaliseTurn(currentTurn));
      }

      currentTurn = {
        speaker: speakerMatch[2] === "1" ? "Speaker A" : "Speaker B",
        originalParts: [speakerMatch[3].trim()],
        hasPauseTag: PAUSE_TAG_PATTERN.test(speakerMatch[3]),
      };
      continue;
    }

    if (currentTurn) {
      currentTurn.originalParts.push(line);
      if (PAUSE_TAG_PATTERN.test(line)) {
        currentTurn.hasPauseTag = true;
      }
    }
  }

  if (currentTurn) {
    turns.push(finaliseTurn(currentTurn));
  }

  return turns.filter((turn) => turn.cleanedText.length > 0 || turn.hasPauseTag);
}

export function cleanToneTags(text) {
  const withoutToneTags = text
    .replace(TONE_TAG_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalizeChemicalNotation(withoutToneTags);
}

export function normalizeChemicalNotation(text) {
  return text
    .replace(CHEMICAL_FORMULA_PATTERN, (match, prefix, formula) => {
      const spokenFormula = formulaToSpokenText(formula);
      return spokenFormula ? `${prefix}${spokenFormula}` : match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function finaliseTurn(turn) {
  const originalText = turn.originalParts.join(" ").replace(/\s+/g, " ").trim();
  const cleanedText = cleanToneTags(originalText);

  return {
    speaker: turn.speaker,
    originalText,
    cleanedText,
    hasPauseTag: turn.hasPauseTag || PAUSE_TAG_PATTERN.test(originalText),
    characterCount: cleanedText.length,
  };
}

function formulaToSpokenText(formula) {
  const parsed = parseFormula(formula);

  if (!parsed || parsed.parts.length === 0) {
    return "";
  }

  if (!parsed.hasNumber && parsed.elementCount === 1 && AMBIGUOUS_STANDALONE_SYMBOLS.has(parsed.onlyElement)) {
    return "";
  }

  return parsed.parts.join(" ");
}

function parseFormula(formula) {
  const parts = [];
  let index = 0;
  let elementCount = 0;
  let onlyElement = "";
  let hasNumber = false;

  while (index < formula.length) {
    if (formula[index] === "(") {
      const closeIndex = formula.indexOf(")", index + 1);
      if (closeIndex === -1) {
        return null;
      }

      const group = parseFormula(formula.slice(index + 1, closeIndex));
      if (!group) {
        return null;
      }

      parts.push(...group.parts);
      elementCount += group.elementCount;
      onlyElement = group.onlyElement || onlyElement;
      hasNumber = hasNumber || group.hasNumber;
      index = closeIndex + 1;

      const numberMatch = formula.slice(index).match(/^\d+/);
      if (numberMatch) {
        parts.push(numberToWords(numberMatch[0]));
        hasNumber = true;
        index += numberMatch[0].length;
      }
      continue;
    }

    const elementMatch = formula.slice(index).match(/^([A-Z][a-z]?)(\d*)/);
    if (!elementMatch || !ELEMENT_SYMBOLS.has(elementMatch[1])) {
      return null;
    }

    const [, symbol, number] = elementMatch;
    parts.push(symbolToLetters(symbol));
    elementCount += 1;
    onlyElement = symbol;

    if (number) {
      parts.push(numberToWords(number));
      hasNumber = true;
    }

    index += symbol.length + number.length;
  }

  return {
    parts,
    elementCount,
    onlyElement,
    hasNumber,
  };
}

function symbolToLetters(symbol) {
  return symbol.toUpperCase().split("").join(" ");
}

function numberToWords(numberText) {
  const number = Number.parseInt(numberText, 10);

  if (NUMBER_WORDS[number]) {
    return NUMBER_WORDS[number];
  }

  return numberText
    .split("")
    .map((digit) => NUMBER_WORDS[digit] || digit)
    .join(" ");
}
