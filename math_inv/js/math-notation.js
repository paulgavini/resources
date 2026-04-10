function isDigit(character) {
  return /^[0-9]$/.test(character ?? "");
}

function isAsciiLetter(character) {
  return /^[A-Za-z]$/.test(character ?? "");
}

function previousNonWhitespaceIndex(text, startIndex) {
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    if (!/\s/.test(text[index])) {
      return index;
    }
  }

  return -1;
}

function contiguousLetterRunLengthBefore(text, startIndex) {
  let length = 0;

  for (let index = startIndex - 1; index >= 0; index -= 1) {
    if (!isAsciiLetter(text[index])) {
      break;
    }

    length += 1;
  }

  return length;
}

function readGroupedValue(text, startIndex) {
  const opener = text[startIndex];
  if (opener !== "{" && opener !== "(") {
    return null;
  }

  const closer = opener === "{" ? "}" : ")";
  let depth = 0;
  let value = "";

  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];

    if (character === opener) {
      if (depth > 0) {
        value += character;
      }
      depth += 1;
      continue;
    }

    if (character === closer) {
      depth -= 1;
      if (depth === 0) {
        return {
          endIndex: index,
          value,
        };
      }

      value += character;
      continue;
    }

    value += character;
  }

  return null;
}

function readUngroupedValue(text, markerIndex) {
  const startIndex = markerIndex + 1;
  const firstCharacter = text[startIndex];

  if (!firstCharacter) {
    return null;
  }

  if (
    (firstCharacter === "+" || firstCharacter === "-") &&
    isDigit(text[startIndex + 1])
  ) {
    let endIndex = startIndex + 2;
    while (isDigit(text[endIndex])) {
      endIndex += 1;
    }

    return {
      endIndex: endIndex - 1,
      value: text.slice(startIndex, endIndex),
    };
  }

  if (isDigit(firstCharacter)) {
    let endIndex = startIndex + 1;
    while (isDigit(text[endIndex])) {
      endIndex += 1;
    }

    return {
      endIndex: endIndex - 1,
      value: text.slice(startIndex, endIndex),
    };
  }

  if (isAsciiLetter(firstCharacter)) {
    if (contiguousLetterRunLengthBefore(text, markerIndex) > 1) {
      return null;
    }

    return {
      endIndex: startIndex,
      value: firstCharacter,
    };
  }

  return null;
}

function readNotationValue(text, markerIndex) {
  const groupedValue = readGroupedValue(text, markerIndex + 1);

  if (groupedValue && groupedValue.value.trim().length > 0) {
    return groupedValue;
  }

  return readUngroupedValue(text, markerIndex);
}

function mergeAdjacentSegments(segments) {
  return segments.reduce((merged, segment) => {
    const previous = merged[merged.length - 1];

    if (previous && previous.script === segment.script) {
      previous.text += segment.text;
      return merged;
    }

    merged.push({ ...segment });
    return merged;
  }, []);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function parseMathNotation(value) {
  const text = String(value ?? "");
  const segments = [];
  let buffer = "";

  const flushBuffer = () => {
    if (!buffer) {
      return;
    }

    segments.push({
      script: "normal",
      text: buffer,
    });
    buffer = "";
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character !== "^" && character !== "_") {
      buffer += character;
      continue;
    }

    if (previousNonWhitespaceIndex(text, index) === -1) {
      buffer += character;
      continue;
    }

    const parsedValue = readNotationValue(text, index);
    if (!parsedValue) {
      buffer += character;
      continue;
    }

    flushBuffer();
    segments.push({
      script: character === "^" ? "super" : "sub",
      text: parsedValue.value,
    });
    index = parsedValue.endIndex;
  }

  flushBuffer();
  return mergeAdjacentSegments(segments);
}

export function renderMathNotationHtml(value) {
  return parseMathNotation(value)
    .map((segment) => {
      const safeText = escapeHtml(segment.text);

      if (segment.script === "super") {
        return `<sup>${safeText}</sup>`;
      }

      if (segment.script === "sub") {
        return `<sub>${safeText}</sub>`;
      }

      return safeText;
    })
    .join("");
}
