/**
 * textParser.js
 * --------------
 * Client-side equivalent of parser.py. Converts raw, line-structured
 * vocabulary text (pasted into a <textarea> or loaded from an uploaded
 * .txt file) into the same flat flashcard array shape the rest of the
 * app expects.
 *
 * This lets the whole pipeline run with zero backend: a learner can
 * paste their vocabulary list straight into the app and get flashcards
 * immediately, no Python step required.
 *
 * OUTPUT SHAPE (one object per card):
 * {
 *   id: 'card-0001',
 *   category: 'BASIC TURKISH NOUNS AND ADJECTIVES',
 *   word: 'Evet',
 *   meaning: 'Yes',
 *   example: 'Evet, biliyorum.',
 *   exampleMeaning: 'Yes, I know.',
 *   status: 'unmarked',
 * }
 */

// Matches "21. Evet Yes" -> captures "Evet Yes" as group 1.
const NUMBERED_LINE_RE = /^\s*\d+\.\s+(.*)$/;

// Splits "Evet, biliyorum. Yes, I know." into the target-language
// example and its translation. We look for the first sentence-ending
// punctuation mark (. ! ?) that is followed by whitespace and then a
// capital letter — that boundary is far more reliable than splitting
// on the first period, since target-language sentences can contain
// abbreviations or commas that aren't the real split point.
const EXAMPLE_SPLIT_RE = /([.!?])\s+(?=[A-ZÇĞİÖŞÜ])/;

/**
 * Splits "Evet Yes" -> ["Evet", "Yes"].
 * Assumption: the target-language word is a single token (the first
 * whitespace-separated chunk); everything after it is the English
 * meaning. This matches the brief's example format.
 */
function splitWordMeaning(remainder) {
  const trimmed = remainder.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    // No space found — nothing to split, meaning stays empty rather
    // than guessing.
    return { word: trimmed, meaning: "" };
  }
  return {
    word: trimmed.slice(0, spaceIndex).trim(),
    meaning: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Splits an example line into its target-language sentence and the
 * translation that follows it.
 */
function splitExampleLine(line) {
  const trimmed = line.trim();
  const match = EXAMPLE_SPLIT_RE.exec(trimmed);
  if (!match) {
    // No reliable split point — keep the whole line as the example and
    // leave the translation blank instead of guessing wrong.
    return { example: trimmed, exampleMeaning: "" };
  }
  const splitAt = match.index + match[1].length; // right after the punctuation
  return {
    example: trimmed.slice(0, splitAt).trim(),
    exampleMeaning: trimmed.slice(splitAt).trim(),
  };
}

/**
 * Main entry point. Takes the full raw text pasted by the user and
 * returns an array of flashcard objects.
 *
 * Parsing rules (mirrors parser.py):
 * - A line that starts with "<number>." is a word/meaning line.
 * - The line immediately following it is the example sentence/translation.
 * - Any other non-blank line is treated as a category header, and applies
 *   to every card parsed after it until the next header appears.
 * - Blank lines are ignored.
 */
export function parseVocabularyText(rawText) {
  const cards = [];
  let currentCategory = null;
  let pendingWord = null; // holds the in-progress card until its example line arrives
  let counter = 0;

  const lines = rawText.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      continue; // blank lines are just spacing, skip
    }

    const numberedMatch = NUMBERED_LINE_RE.exec(line);

    if (numberedMatch) {
      // Starting a new word entry. If a previous one never got its
      // example line (malformed input), flush it as-is rather than
      // losing the vocabulary item.
      if (pendingWord) {
        cards.push(pendingWord);
        pendingWord = null;
      }

      const { word, meaning } = splitWordMeaning(numberedMatch[1]);
      counter += 1;
      pendingWord = {
        id: `card-${String(counter).padStart(4, "0")}`,
        category: currentCategory || "Uncategorized",
        word,
        meaning,
        example: "",
        exampleMeaning: "",
        statuses: [],
      };
      continue;
    }

    if (pendingWord) {
      // This line is the example sentence for the word we just parsed.
      const { example, exampleMeaning } = splitExampleLine(line);
      pendingWord.example = example;
      pendingWord.exampleMeaning = exampleMeaning;
      cards.push(pendingWord);
      pendingWord = null;
      continue;
    }

    // Not numbered, nothing pending -> this is a category header.
    currentCategory = line;
  }

  // Flush a trailing word that never received an example line.
  if (pendingWord) {
    cards.push(pendingWord);
  }

  return cards;
}

/**
 * Convenience helper: parses text and throws a friendly error if
 * nothing usable was found, so the UI can show a clear message instead
 * of silently rendering an empty deck.
 */
export function parseVocabularyTextOrThrow(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    throw new Error("Paste some vocabulary text first.");
  }
  const cards = parseVocabularyText(rawText);
  if (cards.length === 0) {
    throw new Error(
      "No flashcards could be parsed. Check that entries follow the " +
        '"21. Word Meaning" format with an example line underneath.'
    );
  }
  return cards;
}
