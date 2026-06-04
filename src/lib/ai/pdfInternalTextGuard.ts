function countMatches(text: string, pattern: RegExp) {
  return (text.match(pattern) ?? []).length;
}

export function isLikelyPdfInternalText(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lowered = normalized.toLowerCase();
  const trimmed = lowered.trimStart();

  if (trimmed.startsWith("%pdf-")) {
    return true;
  }

  const strongSignals =
    countMatches(lowered, /\bstartxref\b/g) +
    countMatches(lowered, /%%eof\b/g) +
    countMatches(lowered, /\/filter\s*\/flatedecode\b/g) +
    countMatches(lowered, /\/subtype\s*\/cidfonttype0c\b/g);

  if (strongSignals >= 2) {
    return true;
  }

  const structuralSignals =
    countMatches(lowered, /\b\d+\s+\d+\s+obj\b/g) +
    countMatches(lowered, /\bendobj\b/g) +
    countMatches(lowered, /\bstream\b/g) +
    countMatches(lowered, /\bendstream\b/g) +
    countMatches(lowered, /\bxref\b/g) +
    countMatches(lowered, /\btrailer\b/g);

  return structuralSignals >= 20;
}

