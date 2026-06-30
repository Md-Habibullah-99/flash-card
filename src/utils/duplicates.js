/**
 * duplicates.js
 * --------------
 * Detects duplicate cards across an "existing" list and an "incoming"
 * list (new cards about to be imported/restored). A duplicate is
 * defined ONLY by matching WORD + MEANING — category, tags, and
 * example sentences are deliberately ignored. This is intentional: the
 * same target-language word legitimately appears more than once with a
 * DIFFERENT meaning (homonyms, multiple senses), and that should never
 * be flagged as a duplicate. Only an exact word+meaning repeat counts.
 *
 * Comparison is case-insensitive and trims surrounding whitespace, so
 * "Evet / Yes" and "evet / yes " are correctly treated as the same card.
 */

/** Normalizes a string for duplicate comparison: trim + lowercase. */
function normalize(str) {
  return (str || "").trim().toLowerCase();
}

/** Builds the comparison key for a single card: word + meaning, normalized. */
export function duplicateKey(card) {
  return `${normalize(card.word)}::${normalize(card.meaning)}`;
}

/**
 * Splits `incomingCards` into { duplicates, unique } relative to
 * `existingCards`, based purely on word+meaning. `duplicates` keeps a
 * reference to the matching existing card too, so the UI can show
 * "this would duplicate: <existing card>".
 *
 * Also catches duplicates WITHIN `incomingCards` itself (e.g. a backup
 * file that accidentally has the same entry twice) — the first
 * occurrence is kept as unique, later ones are flagged as duplicates of
 * it.
 */
export function findDuplicates(existingCards, incomingCards) {
  const existingByKey = new Map();
  for (const card of existingCards) {
    existingByKey.set(duplicateKey(card), card);
  }

  const duplicates = [];
  const unique = [];
  const seenWithinIncoming = new Map();

  for (const card of incomingCards) {
    const key = duplicateKey(card);
    const existingMatch = existingByKey.get(key) || seenWithinIncoming.get(key);

    if (existingMatch) {
      duplicates.push({ incoming: card, existing: existingMatch });
    } else {
      unique.push(card);
      seenWithinIncoming.set(key, card);
    }
  }

  return { duplicates, unique };
}
