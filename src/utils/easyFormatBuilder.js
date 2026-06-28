/**
 * easyFormatBuilder.js
 * ---------------------
 * Turns plain-language choices into the same {mode:'regex', pattern,
 * flags} shape that formatProfiles.js's custom-regex engine already
 * runs. This is the "no regex knowledge required" path: instead of
 * writing a pattern, the user answers two simple questions —
 *
 *   1. "What separates the word from its meaning on each line?"
 *      -> a SEPARATOR choice (space, colon, dash, comma, tab, or a
 *         custom symbol they type in themselves)
 *   2. "Does each word have an example sentence on the next line?"
 *      -> yes/no, and if yes, the same separator question again for
 *         the example/translation line (defaults to matching #1)
 *
 * From those two answers we build a real regex behind the scenes and
 * hand it to the exact same engine the "Advanced" custom-regex box
 * uses (parseWithCustomRegex in formatProfiles.js) — so this is purely
 * a friendlier front end, not a second parsing implementation to keep
 * in sync.
 *
 * Every separator is escaped before being dropped into the pattern, so
 * a learner typing a literal "." or "(" as their separator can't
 * accidentally break the regex.
 */

// Common separators shown as buttons/choices. `display` is what's
// rendered to the user; `value` is the actual character(s) used to
// build the regex. "custom" lets them type any symbol of their own.
export const SEPARATOR_OPTIONS = [
  { id: "space", display: "a space", value: " " },
  { id: "colon", display: "a colon  :", value: ":" },
  { id: "dash", display: "a dash  -", value: "-" },
  { id: "arrow", display: "an arrow  ->", value: "->" },
  { id: "comma", display: "a comma  ,", value: "," },
  { id: "tab", display: "a tab", value: "\t" },
  { id: "pipe", display: "a vertical bar  |", value: "|" },
  { id: "custom", display: "something else…", value: null }, // user fills in `customValue`
];

/** Escapes regex special characters so any literal symbol is safe to drop into a pattern. */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolves a separator choice (by id, with an optional custom override)
 * into the literal string to use in the regex, with surrounding
 * whitespace tolerance baked in (so "Word: Meaning" and "Word : Meaning"
 * both work without the user needing to think about spacing).
 */
function resolveSeparatorPattern(separatorId, customValue) {
  if (separatorId === "custom") {
    const literal = (customValue || "").trim();
    if (!literal) return null;
    return `[^\\S\\n]*${escapeRegex(literal)}[^\\S\\n]*`;
  }
  const option = SEPARATOR_OPTIONS.find((o) => o.id === separatorId);
  if (!option) return null;
  // [^\S\n] means "whitespace that is NOT a newline" — i.e. spaces and
  // tabs only. Using \s here would also match \n, which lets the word
  // on one line glue onto the meaning on the NEXT line whenever that
  // next line has no separator of its own (e.g. a category header
  // immediately followed by a word/meaning line). Every separator below
  // is built from this newline-safe whitespace class instead.
  if (option.id === "space") return `[^\\S\\n]+`; // one or more horizontal-whitespace characters
  if (option.id === "tab") return `\\t`;
  return `[^\\S\\n]*${escapeRegex(option.value)}[^\\S\\n]*`;
}

/** Human-readable description of a separator choice, for the live preview / saved-profile name. */
export function describeSeparator(separatorId, customValue) {
  if (separatorId === "custom") return `"${customValue || "?"}"`;
  const option = SEPARATOR_OPTIONS.find((o) => o.id === separatorId);
  return option ? option.display : separatorId;
}

/**
 * Builds a {mode, pattern, flags} profile from the simple answers.
 *
 * @param {Object} answers
 * @param {string} answers.wordSeparatorId - id from SEPARATOR_OPTIONS for the word/meaning line
 * @param {string} [answers.wordCustomValue] - literal text when wordSeparatorId === 'custom'
 * @param {boolean} answers.hasExampleLine - whether each entry has a second (example) line
 * @param {string} [answers.exampleSeparatorId] - separator for the example/translation line (defaults to wordSeparatorId)
 * @param {string} [answers.exampleCustomValue]
 */
export function buildEasyProfile(answers) {
  const {
    wordSeparatorId,
    wordCustomValue,
    hasExampleLine,
    exampleSeparatorId,
    exampleCustomValue,
  } = answers;

  const wordSepPattern = resolveSeparatorPattern(wordSeparatorId, wordCustomValue);
  if (!wordSepPattern) {
    throw new Error("Choose what separates the word from its meaning first.");
  }

  // Word/meaning each captured as "everything up to the separator" /
  // "everything to the end of the line" — non-greedy on the word side
  // so a separator that appears more than once still splits at the
  // FIRST occurrence (matches how a learner reads the line).
  const wordLine = `(?<word>[^\\n]+?)${wordSepPattern}(?<meaning>[^\\n]+)`;

  if (!hasExampleLine) {
    return { mode: "regex", pattern: `^${wordLine}$`, flags: "m" };
  }

  const effectiveExampleSepId = exampleSeparatorId || wordSeparatorId;
  const effectiveExampleCustom = exampleSeparatorId ? exampleCustomValue : wordCustomValue;
  const exampleSepPattern = resolveSeparatorPattern(effectiveExampleSepId, effectiveExampleCustom);
  if (!exampleSepPattern) {
    throw new Error("Choose what separates the example sentence from its translation.");
  }

  const exampleLine = `(?<example>[^\\n]+?)${exampleSepPattern}(?<exampleMeaning>[^\\n]+)`;

  // Two lines per card: word line, newline, example line. 'm' so ^ and
  // $ match per-line rather than only at the very start/end of the text.
  return {
    mode: "regex",
    pattern: `^${wordLine}$\\n^${exampleLine}$`,
    flags: "m",
  };
}

/**
 * Generates a short, readable name for a built profile, used as the
 * default when the user saves it (e.g. "Word - Meaning, example with :").
 */
export function describeEasyProfile(answers) {
  const wordDesc = describeSeparator(answers.wordSeparatorId, answers.wordCustomValue);
  if (!answers.hasExampleLine) {
    return `Word/meaning separated by ${wordDesc}`;
  }
  const exampleDesc = describeSeparator(
    answers.exampleSeparatorId || answers.wordSeparatorId,
    answers.exampleSeparatorId ? answers.exampleCustomValue : answers.wordCustomValue
  );
  return `Word/meaning by ${wordDesc}, example by ${exampleDesc}`;
}
