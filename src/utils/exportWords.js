/**
 * exportWords.js
 * ---------------
 * Builds a downloadable export of the word list, with a choice of
 * SCOPE:
 *
 *   - "all"          Every word, grouped by its main category (default).
 *   - a category name Only words in that one main category.
 *   - "no-category"   Every word, ignoring main categories entirely —
 *                     grouped by SUB-category (tag) instead, so the
 *                     export reads as "Difficult: ... / Easy: ... /
 *                     Unread: ..." with no category headers at all.
 *
 * Two output formats are supported:
 *   - JSON  — structured, re-importable via the .json upload path.
 *   - TXT   — human-readable, grouped under headers matching the scope.
 *
 * This file only builds the export's CONTENT (a string) and a
 * suggested filename; triggering the actual browser download happens
 * in the component that calls it, since that's a DOM concern.
 */

import { ALL_WORDS_CATEGORY, UNREAD_TAG_ID, filterByTag, getCardsForCategory } from "./categoryTree.js";

export const EXPORT_SCOPES = {
  ALL: "all",
  NO_CATEGORY: "no-category",
  // any other value is treated as a literal category name
};

/**
 * Resolves the scope into the actual list of cards to export, alongside
 * a label used in the output (and in the suggested filename).
 */
function resolveScope(cards, scope) {
  if (scope === EXPORT_SCOPES.ALL || scope === ALL_WORDS_CATEGORY) {
    return { cards, label: "All Words" };
  }
  if (scope === EXPORT_SCOPES.NO_CATEGORY) {
    return { cards, label: "All Words (no category)" };
  }
  // Otherwise, scope is a specific category name.
  return { cards: getCardsForCategory(cards, scope), label: scope };
}

/** Human label for a tag id, including the derived "unread" pseudo-tag. */
function labelForTagId(tagId, tags) {
  if (tagId === UNREAD_TAG_ID) return "Unread";
  const tag = tags.find((t) => t.id === tagId);
  return tag ? tag.label : tagId;
}

/**
 * Builds the plain-text export. Grouping depends on scope:
 *  - "all" or a specific category: grouped by category header(s), with
 *    each word's tags listed inline after it.
 *  - "no-category": grouped by sub-category (tag) instead — a word
 *    that has multiple tags appears once under EACH tag group it
 *    belongs to (e.g. once under "Easy" and once under "Done").
 */
export function buildTextExport(cards, scope, tags) {
  const { cards: scopedCards, label } = resolveScope(cards, scope);

  if (scopedCards.length === 0) {
    return `No words to export for: ${label}`;
  }

  const lines = [`# ${label}`, ""];

  if (scope === EXPORT_SCOPES.NO_CATEGORY) {
    // Group by tag instead of by category. A card with no tags and not
    // done falls under "Unread"; a card can appear under several tags.
    const allTagIds = [UNREAD_TAG_ID, ...tags.map((t) => t.id)];
    for (const tagId of allTagIds) {
      const cardsForTag = filterByTag(scopedCards, tagId);
      if (cardsForTag.length === 0) continue;
      lines.push(`## ${labelForTagId(tagId, tags)}`);
      for (const card of cardsForTag) {
        lines.push(`${card.word} — ${card.meaning}`);
        if (card.example) lines.push(`  ${card.example} — ${card.exampleMeaning}`);
      }
      lines.push("");
    }
    return lines.join("\n").trim() + "\n";
  }

  // Group by category (one group if scope is a single category, several if "all").
  const categoriesInScope = [];
  for (const card of scopedCards) {
    if (!categoriesInScope.includes(card.category)) categoriesInScope.push(card.category);
  }

  lines.length = 0; // rebuild without the generic "# label" header — use real category headers instead
  for (const category of categoriesInScope) {
    const cardsInCategory = scopedCards.filter((c) => c.category === category);
    lines.push(`## ${category}`);
    for (const card of cardsInCategory) {
      const tagLabels = (card.statuses || [])
        .map((id) => labelForTagId(id, tags))
        .filter(Boolean);
      const tagSuffix = tagLabels.length > 0 ? ` [${tagLabels.join(", ")}]` : " [Unread]";
      lines.push(`${card.word} — ${card.meaning}${tagSuffix}`);
      if (card.example) lines.push(`  ${card.example} — ${card.exampleMeaning}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim() + "\n";
}

/**
 * Builds the JSON export — an array of plain card objects (category,
 * word, meaning, example, exampleMeaning, statuses, plus a resolved
 * `tagLabels` array for readability), ready to be re-imported through
 * the .json upload path later.
 */
export function buildJsonExport(cards, scope, tags) {
  const { cards: scopedCards } = resolveScope(cards, scope);

  return scopedCards.map((card) => ({
    category: scope === EXPORT_SCOPES.NO_CATEGORY ? undefined : card.category,
    word: card.word,
    meaning: card.meaning,
    example: card.example,
    exampleMeaning: card.exampleMeaning,
    statuses: card.statuses || [],
    tagLabels:
      (card.statuses || []).length > 0
        ? card.statuses.map((id) => labelForTagId(id, tags))
        : ["Unread"],
  }));
}

/** Suggests a filename for the export based on scope and format. */
export function suggestExportFilename(scope, extension) {
  const safeScope =
    scope === EXPORT_SCOPES.ALL
      ? "all-words"
      : scope === EXPORT_SCOPES.NO_CATEGORY
      ? "all-words-by-tag"
      : scope
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
  return `vocabulary-${safeScope}.${extension}`;
}

/**
 * Triggers a browser download of the given text content. Kept as a
 * tiny helper here (rather than duplicated inline in the component)
 * since both the JSON and TXT export buttons need the same mechanism.
 */
export function downloadTextFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
