/**
 * useFlashcards.js
 * -----------------
 * Central state manager for the whole app. Wrapping this in a custom
 * hook (rather than spreading useState calls across App.jsx) keeps the
 * "marking engine" — the logic that updates a card's tags and persists
 * it — plus category and tag management, in exactly one place, so
 * App.jsx reads like a layout component instead of a state-management
 * component.
 */

import { useState, useEffect, useCallback } from "react";
import {
  loadCards,
  saveCards,
  loadSettings,
  saveSettings,
  loadTags,
  saveTags,
  loadFormatProfiles,
  saveFormatProfiles,
  clearAllData,
} from "../utils/storage";
import { toggleCardTag, mergeCategories, ALL_WORDS_CATEGORY } from "../utils/categoryTree";

export function useFlashcards() {
  // Lazy initializers so localStorage is only read once, on first mount.
  const [cards, setCards] = useState(() => loadCards());
  const [settings, setSettings] = useState(() => loadSettings());
  const [tags, setTags] = useState(() => loadTags());
  const [formatProfiles, setFormatProfiles] = useState(() => loadFormatProfiles());

  // Persist each piece of state any time it changes. These are the
  // single write paths — every status update, import, tag edit, or
  // category merge goes through the corresponding setter below, so one
  // effect per piece of state is enough to keep localStorage in sync.
  useEffect(() => {
    saveCards(cards);
  }, [cards]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveTags(tags);
  }, [tags]);

  useEffect(() => {
    saveFormatProfiles(formatProfiles);
  }, [formatProfiles]);

  /**
   * Replaces the entire deck — used when a new vocabulary text block is
   * parsed and imported. Existing progress is intentionally cleared
   * here because the imported cards are a new id space; callers that
   * want to *merge* instead of replace should do so before calling this.
   */
  const importCards = useCallback((newCards) => {
    setCards(newCards);
  }, []);

  /**
   * Adds newly parsed cards to the existing deck rather than replacing
   * it — used by "Add words" so importing a second vocabulary list
   * doesn't wipe progress on the first one. Card ids are renumbered to
   * avoid collisions with existing ids.
   */
  const addCards = useCallback((newCards) => {
    setCards((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      let counter = prev.length;
      const renumbered = newCards.map((c) => {
        let id = c.id;
        while (existingIds.has(id)) {
          counter += 1;
          id = `card-${String(counter).padStart(4, "0")}`;
        }
        existingIds.add(id);
        return { ...c, id };
      });
      return [...prev, ...renumbered];
    });
  }, []);

  /**
   * The marking engine. Toggles a single tag on a single card by id,
   * honoring mutual-exclusion rules (see utils/categoryTree.js). Because
   * every sub-category view (Difficult/Easy/Favorite/Done + any custom
   * tags, in both the main category and "All Words") is just a filter
   * over `cards`, this one update is all that's needed for the change
   * to instantly reflect everywhere.
   */
  const toggleTag = useCallback((cardId, tagId) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? { ...card, statuses: toggleCardTag(card.statuses, tagId) }
          : card
      )
    );
  }, []);

  /** Updates a single settings flag (resetMeaningOnNavigation, etc). */
  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  /** Wipes all cards, tags, and format profiles, and resets settings — used by the Reset Data control. */
  const resetAll = useCallback(() => {
    clearAllData();
    setCards([]);
    setTags(loadTags()); // re-seed with built-ins
    setFormatProfiles([]);
  }, []);

  // ---- Category management -------------------------------------------

  /**
   * Merges `fromCategory` into `toCategory` (or simply renames it, if
   * `toCategory` is a brand-new name). "All Words" can't be merged or
   * renamed — mergeCategories() already guards against that, this is
   * just the state-update wrapper around it.
   */
  const mergeCategory = useCallback((fromCategory, toCategory) => {
    if (fromCategory === ALL_WORDS_CATEGORY) return;
    setCards((prev) => mergeCategories(prev, fromCategory, toCategory));
  }, []);

  // ---- Tag (sub-category) management ----------------------------------

  /** Adds a new custom tag. Ids are slugified from the label to stay readable in storage. */
  const addCustomTag = useCallback((label) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setTags((prev) => {
      if (!id || prev.some((t) => t.id === id)) return prev; // no duplicates
      return [...prev, { id, label: trimmed, builtIn: false }];
    });
  }, []);

  /** Renames an existing tag (built-in or custom) — the tag id stays stable so existing card tags still match. */
  const renameTag = useCallback((tagId, newLabel) => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    setTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, label: trimmed } : t)));
  }, []);

  /** Deletes a custom tag (built-ins can't be deleted) and strips it from any cards that had it. */
  const deleteCustomTag = useCallback((tagId) => {
    setTags((prev) => prev.filter((t) => !(t.id === tagId && !t.builtIn)));
    setCards((prev) =>
      prev.map((c) =>
        c.statuses?.includes(tagId)
          ? { ...c, statuses: c.statuses.filter((s) => s !== tagId) }
          : c
      )
    );
  }, []);

  // ---- Format profile management ---------------------------------------

  /** Saves a custom regex/preset profile for reuse next time the user imports text. */
  const saveFormatProfile = useCallback((profile) => {
    setFormatProfiles((prev) => [...prev, { ...profile, id: `profile-${Date.now()}` }]);
  }, []);

  const deleteFormatProfile = useCallback((profileId) => {
    setFormatProfiles((prev) => prev.filter((p) => p.id !== profileId));
  }, []);

  return {
    cards,
    settings,
    tags,
    formatProfiles,
    importCards,
    addCards,
    toggleTag,
    updateSetting,
    resetAll,
    mergeCategory,
    addCustomTag,
    renameTag,
    deleteCustomTag,
    saveFormatProfile,
    deleteFormatProfile,
  };
}
