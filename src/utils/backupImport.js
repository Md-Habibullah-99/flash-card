/**
 * backupImport.js
 * ----------------
 * Reads back a file previously produced by utils/exportWords.js — this
 * is a BACKUP/RESTORE path, distinct from the vocabulary-import path in
 * formatProfiles.js. The difference matters: a fresh vocabulary import
 * only ever produces word/meaning/example and starts every card
 * unmarked, whereas a backup restore must bring CATEGORY and TAGS back
 * exactly as they were exported, since the whole point is "get my
 * progress back."
 *
 * Supports both export formats:
 *
 *  - JSON  — array of { category, word, meaning, example,
 *            exampleMeaning, statuses, tagLabels }. `statuses` (the
 *            real tag ids) is trusted as the source of truth;
 *            `tagLabels` is display-only and ignored on restore. If a
 *            backup was made with "no category" scope, `category` is
 *            absent on every entry and restored cards fall back to
 *            "Uncategorized".
 *
 *  - TXT   — the human-readable export shape:
 *              ## Category Name        (or a tag name, if exported with "no category")
 *              Word — Meaning [Tag, Tag]
 *                Example — Example translation
 *            Lines are matched structurally (the "## " header prefix,
 *            the " — " separator, the leading two-space indent for the
 *            example line) rather than guessed at, since this is OUR
 *            OWN fixed export format, not a user-defined one.
 *
 * Tag labels found in the TXT format (e.g. "[Easy, Done]") are mapped
 * back to tag IDS using the CURRENT app tag list (by matching label
 * text case-insensitively), so a renamed tag still restores correctly
 * as long as the original label or the current label matches. Unknown
 * labels are dropped rather than invented as new tags, since silently
 * creating tags from typos would be more confusing than helpful.
 */

import { UNREAD_TAG_ID } from "./categoryTree.js";

let counter = 0;
function nextId() {
  counter += 1;
  return `restored-${Date.now()}-${counter}`;
}

/** Maps a list of human tag labels back to tag ids, using the current tag list. Unknown labels are dropped. "Unread" is always dropped (it's derived, never stored). */
function labelsToTagIds(labels, tags) {
  const ids = [];
  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed || trimmed.toLowerCase() === "unread") continue;
    const match = tags.find((t) => t.label.toLowerCase() === trimmed.toLowerCase());
    if (match) ids.push(match.id);
  }
  return ids;
}

/**
 * Parses a JSON backup string into full card objects.
 * @param {string} jsonText
 * @param {Array} tags - current app tag list, used only to validate that statuses are known ids (unknown ids are kept as-is in case a custom tag was deleted and re-added with the same id later)
 */
export function parseJsonBackup(jsonText, tags) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error("This file isn't valid JSON.");
  }

  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.cards) ? parsed.cards : null;
  if (!list) {
    throw new Error("This JSON file doesn't look like a Vocabulary Drawer backup.");
  }

  const cards = [];
  for (const raw of list) {
    if (!raw.word) continue; // skip entries with no usable word
    cards.push({
      id: nextId(),
      category: raw.category || "Uncategorized",
      word: String(raw.word).trim(),
      meaning: String(raw.meaning || "").trim(),
      example: String(raw.example || "").trim(),
      exampleMeaning: String(raw.exampleMeaning || "").trim(),
      statuses: Array.isArray(raw.statuses) ? raw.statuses.filter((s) => s !== UNREAD_TAG_ID) : [],
    });
  }

  if (cards.length === 0) {
    throw new Error("No usable cards were found in this backup file.");
  }

  return cards;
}

/**
 * Parses a TXT backup string (our own export shape) into full card
 * objects. See module docstring for the exact shape expected.
 */
export function parseTextBackup(textContent, tags) {
  const cards = [];
  let currentHeader = "Uncategorized";
  let pendingCard = null;

  const wordLineRe = /^(.+?)\s+—\s+(.+?)(?:\s*\[(.+)\])?$/;
  const exampleLineRe = /^ {2}(.+?)\s+—\s+(.+)$/; // two-space indent, same em-dash separator

  for (const rawLine of textContent.split(/\r?\n/)) {
    const line = rawLine.replace(/\r$/, "");
    const trimmed = line.trim();

    if (!trimmed) {
      continue; // blank lines just separate groups, no data lost by skipping
    }

    if (trimmed.startsWith("# ")) {
      continue; // the top-level "# All Words" title line — not a real category, skip
    }

    if (trimmed.startsWith("## ")) {
      if (pendingCard) {
        cards.push(pendingCard);
        pendingCard = null;
      }
      currentHeader = trimmed.slice(3).trim();
      continue;
    }

    // Example line: starts with exactly two leading spaces in the
    // ORIGINAL (untrimmed) line, distinguishing it from a word line.
    const exampleMatch = line.startsWith("  ") ? exampleLineRe.exec(line) : null;
    if (exampleMatch && pendingCard) {
      pendingCard.example = exampleMatch[1].trim();
      pendingCard.exampleMeaning = exampleMatch[2].trim();
      continue;
    }

    // Otherwise, this is a new word/meaning line.
    if (pendingCard) {
      cards.push(pendingCard);
      pendingCard = null;
    }

    const wordMatch = wordLineRe.exec(trimmed);
    if (!wordMatch) continue; // not a recognizable line — skip rather than guess

    const [, word, meaning, tagLabelsRaw] = wordMatch;
    const tagLabels = tagLabelsRaw ? tagLabelsRaw.split(",").map((s) => s.trim()) : [];

    pendingCard = {
      id: nextId(),
      // currentHeader is either a real category (when exported "all"/
      // single-category) OR a tag name (when exported "no category").
      // We can't always tell which from the file alone, so we treat it
      // as the category — if it was actually a tag-group header, the
      // tags array below already carries the real per-card tag info in
      // the [brackets] anyway, so nothing is lost; the category just
      // ends up labeled by the tag-group name, which the user can
      // rename or merge afterward via the category management UI.
      category: currentHeader,
      word: word.trim(),
      meaning: meaning.trim(),
      example: "",
      exampleMeaning: "",
      statuses: labelsToTagIds(tagLabels, tags),
    };
  }

  if (pendingCard) cards.push(pendingCard);

  if (cards.length === 0) {
    throw new Error("No recognizable entries were found in this backup file.");
  }

  return cards;
}

/** Picks the right parser based on file extension. */
export function parseBackupFile(fileName, fileContent, tags) {
  const isJson = fileName.toLowerCase().endsWith(".json");
  return isJson ? parseJsonBackup(fileContent, tags) : parseTextBackup(fileContent, tags);
}
