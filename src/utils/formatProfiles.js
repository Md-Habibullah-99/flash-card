/**
 * formatProfiles.js
 * ------------------
 * Defines the set of supported input text formats and turns a "format
 * profile" (either a built-in preset or a user-written regex) into a
 * parsing function. This sits ABOVE textParser.js: textParser.js still
 * contains the original "21. Word Meaning" / example-line parser as the
 * default preset, and this file adds the alternate presets plus the
 * fully custom regex path requested in settings.
 *
 * SUPPORTED PRESETS
 * ------------------
 * Each preset describes a two-line (or one-line) record shape. All
 * presets ignore blank lines and treat any non-matching, non-blank line
 * as a category header (same convention as the original parser).
 *
 *  - "numbered"        21. Word Meaning             (original default)
 *                       Example sentence. Translation.
 *
 *  - "quoted-space"     "Word" "Meaning"
 *                       "Example" "Translation"
 *
 *  - "colon"            Word : Meaning
 *                       Example : Translation
 *
 *  - "space-pair"       Word Meaning
 *                       Example Translation
 *
 *  - "three-line"       Word
 *                       Meaning
 *                       Example
 *                       (exampleMeaning left blank — only 3 lines/card)
 *
 * CUSTOM REGEX MODE
 * ------------------
 * Power users can supply their own regular expression with named
 * capture groups: (?<word>...) (?<meaning>...) and optionally
 * (?<example>...) (?<exampleMeaning>...). The regex is run with the
 * 'gm' flags (global + multiline) against the WHOLE text at once
 * (rather than line-by-line), since custom formats may not be strictly
 * line-based. Category headers in regex mode are still detected the
 * same way: any non-blank line that the regex does not consume as part
 * of a match is treated as a header for everything that follows it.
 */

import { parseVocabularyText as parseNumberedFormat } from "./textParser.js";

export const PRESETS = [
  {
    id: "numbered",
    label: '21. Word Meaning  /  Example. Translation.',
    description: "The original numbered format: number, word, meaning on one line; example + translation on the next.",
  },
  {
    id: "quoted-space",
    label: '"Word" "Meaning"',
    description: 'Word and meaning each wrapped in quotes, separated by a space. Example line uses the same shape.',
  },
  {
    id: "colon",
    label: "Word : Meaning",
    description: "Word and meaning separated by a colon. Example line uses the same shape.",
  },
  {
    id: "space-pair",
    label: "Word Meaning",
    description: "Word and meaning separated by whitespace, no numbering or punctuation required.",
  },
  {
    id: "three-line",
    label: "Word / Meaning / Example (3 lines each)",
    description: "Word on its own line, meaning on the next line, example sentence on the third line.",
  },
];

let counter = 0;
function nextId() {
  counter += 1;
  return `card-${String(counter).padStart(4, "0")}`;
}

/** Splits "Evet, biliyorum. Yes, I know." at the first sentence end followed by a capital letter. Generic fallback used by presets with no explicit delimiter (numbered, space-pair, three-line). */
function splitExampleLine(line) {
  const trimmed = line.trim();
  const match = /([.!?])\s+(?=[A-ZÇĞİÖŞÜ])/.exec(trimmed);
  if (!match) return { example: trimmed, exampleMeaning: "" };
  const splitAt = match.index + match[1].length;
  return {
    example: trimmed.slice(0, splitAt).trim(),
    exampleMeaning: trimmed.slice(splitAt).trim(),
  };
}

/** Splits an example line on an explicit colon delimiter, e.g. "Evet, biliyorum. : Yes, I know." */
function splitExampleLineByColon(line) {
  const m = /^(.+?)\s*:\s*(.+)$/.exec(line.trim());
  return m ? { example: m[1].trim(), exampleMeaning: m[2].trim() } : { example: line.trim(), exampleMeaning: "" };
}

/** Splits a quoted example line, e.g. '"Evet, biliyorum." "Yes, I know."' */
function splitExampleLineByQuotes(line) {
  const m = /^"([^"]+)"\s+"([^"]+)"$/.exec(line.trim());
  return m ? { example: m[1].trim(), exampleMeaning: m[2].trim() } : { example: line.trim(), exampleMeaning: "" };
}

/**
 * Generic two-line-per-card parser used by quoted-space, colon, and
 * space-pair presets. Lines alternate strictly by POSITION: the first
 * non-blank, non-header line starts a card (the word/meaning line), and
 * the very next non-blank line is always that card's example line —
 * we do NOT re-test the word/meaning pattern on the second line, since
 * for colon/quoted/space-pair formats the example line has the exact
 * same shape (it also contains a colon, quotes, or a space) and would
 * otherwise be mistaken for a brand new card.
 *
 * A line is only treated as a category HEADER when no card is pending
 * (i.e. we're between cards) AND it doesn't match the word/meaning
 * pattern at all — this lets a header line that happens to contain a
 * colon or quotes still be recognized correctly, as long as it's
 * encountered in "look for the next card" position.
 *
 * `lineMatcher` takes a trimmed line and returns either { word, meaning }
 * if it matches the "word/meaning" line shape, or null otherwise.
 * `exampleSplitter` (defaults to the generic sentence-punctuation
 * heuristic) splits the example line using whatever delimiter that
 * preset's word lines use, so the example line is parsed consistently
 * with the rest of the format rather than guessed at.
 */
function parseTwoLineFormat(rawText, lineMatcher, exampleSplitter = splitExampleLine) {
  const cards = [];
  let currentCategory = null;
  let pendingWord = null; // set once we've consumed a word/meaning line, cleared once its example line arrives

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (pendingWord) {
      // We are positionally expecting THIS line to be the example line
      // for pendingWord, regardless of whether it also happens to match
      // the word/meaning pattern.
      const { example, exampleMeaning } = exampleSplitter(line);
      pendingWord.example = example;
      pendingWord.exampleMeaning = exampleMeaning;
      cards.push(pendingWord);
      pendingWord = null;
      continue;
    }

    const wordMatch = lineMatcher(line);

    if (wordMatch) {
      pendingWord = {
        id: nextId(),
        category: currentCategory || "Uncategorized",
        word: wordMatch.word,
        meaning: wordMatch.meaning,
        example: "",
        exampleMeaning: "",
        statuses: [],
      };
      continue;
    }

    // Not pending a card, and this line doesn't match the word/meaning
    // shape -> it's a category header.
    currentCategory = line;
  }

  if (pendingWord) cards.push(pendingWord);
  return cards;
}

function parseQuotedSpace(rawText) {
  // "Word" "Meaning"  — two quoted chunks separated by whitespace
  const re = /^"([^"]+)"\s+"([^"]+)"$/;
  return parseTwoLineFormat(
    rawText,
    (line) => {
      const m = re.exec(line);
      return m ? { word: m[1].trim(), meaning: m[2].trim() } : null;
    },
    splitExampleLineByQuotes
  );
}

function parseColon(rawText) {
  // Word : Meaning — colon with optional surrounding whitespace
  const re = /^(.+?)\s*:\s*(.+)$/;
  return parseTwoLineFormat(
    rawText,
    (line) => {
      const m = re.exec(line);
      return m ? { word: m[1].trim(), meaning: m[2].trim() } : null;
    },
    splitExampleLineByColon
  );
}

function parseSpacePair(rawText) {
  // Word Meaning — first whitespace-separated token is the word, rest is meaning
  return parseTwoLineFormat(rawText, (line) => {
    const spaceIndex = line.indexOf(" ");
    if (spaceIndex === -1) return null; // a lone word with no meaning -> treat as header instead
    return {
      word: line.slice(0, spaceIndex).trim(),
      meaning: line.slice(spaceIndex + 1).trim(),
    };
  });
}

function parseThreeLine(rawText) {
  // Word / Meaning / Example, three lines per card, no translation line.
  const cards = [];
  let currentCategory = null;
  let buffer = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const [word, meaning = "", example = ""] = buffer;
    cards.push({
      id: nextId(),
      category: currentCategory || "Uncategorized",
      word,
      meaning,
      example,
      exampleMeaning: "",
      statuses: [],
    });
    buffer = [];
  };

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      // A blank line ends the current 3-line block early if we already
      // have at least a word, so single/double-line entries still work.
      flush();
      continue;
    }
    if (buffer.length === 0 && looksLikeHeader(line)) {
      currentCategory = line;
      continue;
    }
    buffer.push(line);
    if (buffer.length === 3) flush();
  }
  flush();

  return cards;
}

// A line "looks like a header" in three-line mode if the NEXT two lines
// don't exist yet — we can't look ahead easily here, so instead we use a
// simple heuristic: a header line is short, has no lowercase-following-
// punctuation pattern, and is typically the first line after a blank
// gap. To keep this predictable, three-line mode treats a line as a
// header only when it's in ALL CAPS (matching the convention used by
// every example in this app's source documents).
function looksLikeHeader(line) {
  const letters = line.replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

/**
 * Runs a regex against text and returns the raw match spans with their
 * named-group boundaries, WITHOUT turning them into card objects. Used
 * purely for the visual "what is my regex selecting?" highlight preview
 * in ImportPanel — parseWithCustomRegex (below) does the real parsing
 * for actual imports; this is a read-only inspection of the same regex.
 *
 * Uses the regex 'd' (hasIndices) flag to get EXACT per-group character
 * offsets directly from the engine, rather than guessing via indexOf —
 * indexOf breaks as soon as two groups capture the same text (e.g. the
 * word "Merhaba" appearing in both the word line and, coincidentally,
 * the example line), which a learner's real vocabulary text does often
 * enough that this needed to be exact, not approximate.
 *
 * Returns an array of { matchStart, matchEnd, groups: { word: {start,end}|null, ... } }
 * one entry per match found, in document order.
 */
export function getRegexMatchSpans(rawText, pattern, flags) {
  let regex;
  try {
    const safeFlags = new Set((flags || "").split(""));
    safeFlags.add("g");
    safeFlags.add("d"); // hasIndices — required for exact per-group offsets
    regex = new RegExp(pattern, [...safeFlags].join(""));
  } catch (err) {
    throw new Error(`Invalid regular expression: ${err.message}`);
  }

  const spans = [];
  let match;
  let safetyCounter = 0;

  while ((match = regex.exec(rawText)) !== null && safetyCounter < 5000) {
    safetyCounter += 1;
    const groupSpans = {};

    if (match.groups && match.indices && match.indices.groups) {
      for (const name of Object.keys(match.groups)) {
        const range = match.indices.groups[name];
        groupSpans[name] = range ? { start: range[0], end: range[1] } : null;
      }
    }

    spans.push({ matchStart: match.index, matchEnd: match.index + match[0].length, groups: groupSpans });

    if (match[0].length === 0) regex.lastIndex += 1; // avoid infinite loop on zero-length matches
  }

  return spans;
}

/**
 * Runs a user-supplied custom regex against the whole text at once.
 * The regex must use named groups: (?<word>...) and (?<meaning>...) are
 * required; (?<example>...) and (?<exampleMeaning>...) are optional.
 *
 * Category headers: any stretch of text between the end of one match
 * and the start of the next is scanned line-by-line; non-blank lines
 * found there are treated as category headers (last one wins, applies
 * forward).
 */
export function parseWithCustomRegex(rawText, pattern, flags) {
  let regex;
  try {
    regex = new RegExp(pattern, flags.includes("g") ? flags : flags + "g");
  } catch (err) {
    throw new Error(`Invalid regular expression: ${err.message}`);
  }

  const cards = [];
  let currentCategory = null;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    // Scan the gap between the previous match and this one for header lines.
    const gapText = rawText.slice(lastIndex, match.index);
    for (const rawLine of gapText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line) currentCategory = line;
    }
    lastIndex = match.index + match[0].length;

    const groups = match.groups || {};
    if (!groups.word) {
      // A match with no captured word is useless as a card; skip it
      // rather than producing an empty entry.
      if (match[0].length === 0) regex.lastIndex += 1; // avoid infinite loop on zero-length matches
      continue;
    }

    cards.push({
      id: nextId(),
      category: currentCategory || "Uncategorized",
      word: (groups.word || "").trim(),
      meaning: (groups.meaning || "").trim(),
      example: (groups.example || "").trim(),
      exampleMeaning: (groups.exampleMeaning || "").trim(),
      statuses: [],
    });
  }

  return cards;
}

/**
 * Main entry point used by ImportPanel. Given the raw text and a format
 * profile object, returns the parsed card array.
 *
 * @param {string} rawText
 * @param {{mode: 'preset'|'regex', preset?: string, pattern?: string, flags?: string}} profile
 */
export function parseWithProfile(rawText, profile) {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error("Paste some vocabulary text first.");
  }

  let cards;

  if (profile.mode === "regex") {
    if (!profile.pattern || profile.pattern.trim().length === 0) {
      throw new Error("Enter a regular expression pattern first.");
    }
    cards = parseWithCustomRegex(rawText, profile.pattern, profile.flags || "");
  } else {
    switch (profile.preset) {
      case "quoted-space":
        cards = parseQuotedSpace(rawText);
        break;
      case "colon":
        cards = parseColon(rawText);
        break;
      case "space-pair":
        cards = parseSpacePair(rawText);
        break;
      case "three-line":
        cards = parseThreeLine(rawText);
        break;
      case "numbered":
      default:
        cards = parseNumberedFormat(rawText);
        break;
    }
  }

  if (cards.length === 0) {
    throw new Error(
      "No flashcards could be parsed with this format. Double-check the pattern against your text, or try a different preset."
    );
  }

  return cards;
}
