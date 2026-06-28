/**
 * storage.js
 * ----------
 * Thin wrapper around localStorage so the rest of the app never touches
 * `window.localStorage` directly. Centralizing this means:
 *  - Key names live in one place (no typos across components).
 *  - JSON parse/stringify errors are caught in one place.
 *  - Swapping persistence strategy later (e.g. IndexedDB) only touches
 *    this file.
 *  - One-time data migrations (e.g. old single `status` -> new
 *    `statuses` array) happen in exactly one place, on load.
 */

import { BUILT_IN_TAGS } from "./categoryTree.js";

const KEYS = {
  CARDS: "flashcards.cards.v1",
  SETTINGS: "flashcards.settings.v1",
  TAGS: "flashcards.tags.v1",
  FORMAT_PROFILES: "flashcards.formatProfiles.v1",
  HISTORY: "flashcards.history.v1",
};

/** Default settings used the very first time the app loads. */
export const DEFAULT_SETTINGS = {
  resetMeaningOnNavigation: true,
  audioEnabled: false, // placeholder flag for future text-to-speech
  shuffleMode: false,
};

function safeParse(rawValue, fallback) {
  if (rawValue === null) return fallback;
  try {
    return JSON.parse(rawValue);
  } catch (err) {
    console.warn("Failed to parse stored value, using fallback.", err);
    return fallback;
  }
}

/**
 * Migrates a single card from any older shape to the current shape.
 * Older saves had `status: 'difficult' | 'easy' | ... | 'unmarked'`
 * (singular, one value). The current shape is `statuses: string[]`
 * (zero or more tag ids). 'unmarked' simply becomes an empty array.
 */
function migrateCard(card) {
  if (Array.isArray(card.statuses)) return card; // already current shape
  const { status, ...rest } = card;
  const statuses = status && status !== "unmarked" ? [status] : [];
  return { ...rest, statuses };
}

export function loadCards() {
  const raw = safeParse(localStorage.getItem(KEYS.CARDS), []);
  return raw.map(migrateCard);
}

export function saveCards(cards) {
  try {
    localStorage.setItem(KEYS.CARDS, JSON.stringify(cards));
  } catch (err) {
    // Most likely a quota error — surfaced to console rather than
    // crashing the app, since losing persistence isn't fatal mid-session.
    console.error("Failed to save cards to localStorage.", err);
  }
}

export function loadSettings() {
  return safeParse(localStorage.getItem(KEYS.SETTINGS), DEFAULT_SETTINGS);
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error("Failed to save settings to localStorage.", err);
  }
}

/** Loads the active tag list, seeding it with the four built-ins on first run. */
export function loadTags() {
  return safeParse(localStorage.getItem(KEYS.TAGS), BUILT_IN_TAGS);
}

export function saveTags(tags) {
  try {
    localStorage.setItem(KEYS.TAGS, JSON.stringify(tags));
  } catch (err) {
    console.error("Failed to save tags to localStorage.", err);
  }
}

/** Loads user-saved custom import format profiles (see utils/formatProfiles.js). */
export function loadFormatProfiles() {
  return safeParse(localStorage.getItem(KEYS.FORMAT_PROFILES), []);
}

export function saveFormatProfiles(profiles) {
  try {
    localStorage.setItem(KEYS.FORMAT_PROFILES, JSON.stringify(profiles));
  } catch (err) {
    console.error("Failed to save format profiles to localStorage.", err);
  }
}

/**
 * Loads the "recently viewed" history — the last 30 cards that became
 * the active card in the deck viewer, most recent first. See
 * useFlashcards.js's recordView() for how entries are added and capped.
 */
export function loadHistory() {
  return safeParse(localStorage.getItem(KEYS.HISTORY), []);
}

export function saveHistory(history) {
  try {
    localStorage.setItem(KEYS.HISTORY, JSON.stringify(history));
  } catch (err) {
    console.error("Failed to save history to localStorage.", err);
  }
}

export function clearAllData() {
  localStorage.removeItem(KEYS.CARDS);
  localStorage.removeItem(KEYS.SETTINGS);
  localStorage.removeItem(KEYS.TAGS);
  localStorage.removeItem(KEYS.FORMAT_PROFILES);
  localStorage.removeItem(KEYS.HISTORY);
}
