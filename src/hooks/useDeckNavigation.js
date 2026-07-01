/**
 * useDeckNavigation.js
 * ---------------------
 * Manages navigation through the *currently active deck* (the filtered
 * list of cards for the selected category + status). This is kept
 * separate from useFlashcards because it's view-state (which card am I
 * looking at) rather than data-state (what are the cards), and it needs
 * to reset/reshuffle whenever the active deck itself changes.
 *
 * Responsibilities:
 *  - Tracks the current index within the deck.
 *  - Tracks whether the current card's meaning is revealed.
 *  - Applies shuffle mode (Fisher-Yates) when settings.shuffleMode is on,
 *    re-shuffling whenever the underlying deck identity changes.
 *  - Resets the reveal state on navigation when
 *    settings.resetMeaningOnNavigation is enabled; otherwise carries the
 *    reveal state forward as the brief specifies.
 */

import { useState, useEffect, useMemo, useRef } from "react";

function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * @param {Array} deckCards - the filtered cards for the active category/status
 * @param {string} deckKey - a string identifying the active deck (e.g. "All Words::difficult")
 *                           used to detect when the user switched views, so we can
 *                           reset position and reshuffle.
 * @param {boolean} shuffleMode
 * @param {boolean} resetMeaningOnNavigation
 */
export function useDeckNavigation(deckCards, deckKey, shuffleMode, resetMeaningOnNavigation) {
  const [orderedIds, setOrderedIds] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const previousDeckKey = useRef(null);

  // Whenever the *selected view* changes (different category/status), or
  // the underlying card ids in that view change (e.g. a card just got
  // marked into/out of this filter), recompute the order. We only reset
  // position back to 0 when the view itself changed — not on every
  // status-toggle re-render — so marking the card you're looking at
  // doesn't yank you back to the start of the deck.
  useEffect(() => {
  const ids = deckCards.map((c) => c.id);
  const nextOrder = shuffleMode ? shuffleArray(ids) : ids;

  // If the deck is empty, reset everything and bail out
  if (nextOrder.length === 0) {
    setOrderedIds([]);
    setCurrentIndex(0);
    setIsRevealed(false);
    previousDeckKey.current = deckKey;
    return;
  }

  setOrderedIds(nextOrder);

  if (previousDeckKey.current !== deckKey) {
    // View changed – reset to the first card
    setCurrentIndex(0);
    setIsRevealed(false);
    previousDeckKey.current = deckKey;
  } else {
    // Same view – clamp index safely
    setCurrentIndex((idx) => {
      const safeIdx = Math.min(idx, nextOrder.length - 1);
      return Math.max(safeIdx, 0); // ensure we never go negative
    });
  }
}, [deckKey, deckCards.length, shuffleMode]);

  const cardsById = useMemo(() => {
    const map = new Map();
    for (const c of deckCards) map.set(c.id, c);
    return map;
  }, [deckCards]);

  const currentCard = orderedIds.length
    ? cardsById.get(orderedIds[currentIndex])
    : null;

  const goNext = () => {
    if (orderedIds.length === 0) return;
    setCurrentIndex((i) => (i + 1) % orderedIds.length);
    if (resetMeaningOnNavigation) setIsRevealed(false);
  };

  const goPrevious = () => {
    if (orderedIds.length === 0) return;
    setCurrentIndex((i) => (i - 1 + orderedIds.length) % orderedIds.length);
    if (resetMeaningOnNavigation) setIsRevealed(false);
  };

  const toggleReveal = () => setIsRevealed((r) => !r);

  return {
    currentCard,
    currentIndex,
    deckLength: orderedIds.length,
    isRevealed,
    goNext,
    goPrevious,
    toggleReveal,
  };
}
