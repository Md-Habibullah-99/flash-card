/**
 * App.jsx
 * --------
 * Top-level layout and state wiring. Deliberately thin: all persistence
 * and marking logic lives in hooks/useFlashcards.js, all category/tag
 * filtering logic lives in utils/categoryTree.js, and all deck-position
 * logic lives in hooks/useDeckNavigation.js. This file's only job is to
 * connect those pieces to the visual components, plus the global
 * keyboard shortcuts (Space to flip, arrows to navigate).
 *
 * View states:
 *  1. Import view — shown when there are no cards yet, or via "Add words".
 *  2. Study view — sidebar (categories/tags) + active flashcard + controls.
 */

import React, { useState, useMemo, useEffect } from "react";
import { Settings as SettingsIcon, Plus } from "lucide-react";

import Sidebar from "./components/Sidebar";
import Flashcard from "./components/Flashcard";
import DeckControls from "./components/DeckControls";
import SettingsPanel from "./components/SettingsPanel";
import ImportPanel from "./components/ImportPanel";
import DuplicateReviewPanel from "./components/DuplicateReviewPanel";

import { useFlashcards } from "./hooks/useFlashcards";
import { useDeckNavigation } from "./hooks/useDeckNavigation";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  getCategoryList,
  getActiveDeck,
  getTagCounts,
  ALL_WORDS_CATEGORY,
} from "./utils/categoryTree";

export default function App() {
  const {
    cards,
    settings,
    tags,
    formatProfiles,
    history,
    importCards,
    addCards,
    restoreCards,
    checkForDuplicates,
    toggleTag,
    updateSetting,
    resetAll,
    mergeCategory,
    addCustomTag,
    renameTag,
    deleteCustomTag,
    saveFormatProfile,
    deleteFormatProfile,
    recordView,
    clearHistory,
  } = useFlashcards();

  const [activeCategory, setActiveCategory] = useState(ALL_WORDS_CATEGORY);
  const [activeTag, setActiveTag] = useState("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Set whenever a parsed/restored batch has one or more duplicates
  // (by word+meaning) against the existing deck: { cards, mode }, where
  // mode is 'import' (came from ImportPanel, uses addCards/importCards
  // on confirm) or 'restore' (came from a Settings backup upload, uses
  // restoreCards on confirm so tags get re-created too). While this is
  // set, DuplicateReviewPanel replaces whatever view would otherwise be
  // showing, so the learner resolves duplicates before anything commits.
  const [pendingImport, setPendingImport] = useState(null);

  const categories = useMemo(() => getCategoryList(cards), [cards]);

  const activeDeck = useMemo(
    () => getActiveDeck(cards, activeCategory, activeTag),
    [cards, activeCategory, activeTag]
  );

  const deckKey = `${activeCategory}::${activeTag}`;

  const {
    currentCard,
    currentIndex,
    deckLength,
    isRevealed,
    goNext,
    goPrevious,
    toggleReveal,
  } = useDeckNavigation(activeDeck, deckKey, settings.shuffleMode, settings.resetMeaningOnNavigation);

  // Log every card that becomes the active one in the deck viewer, so
  // "recently viewed" always reflects what the learner actually looked
  // at — independent of which category/tag filter they were browsing
  // through to get there. Keyed on the card's id so flipping/marking
  // the SAME card doesn't re-log it; only actually navigating to a
  // different card does.
  useEffect(() => {
    if (currentCard) recordView(currentCard);
  }, [currentCard?.id, recordView]);

  const handleSelectCategory = (category, tagId) => {
    setActiveCategory(category);
    setActiveTag(tagId);
  };

  const handleToggleTag = (tagId) => {
    if (currentCard) toggleTag(currentCard.id, tagId);
  };

  const getCounts = (category) => getTagCounts(cards, category, tags);

  const hasExistingCards = cards.length > 0;
  const showImportView = (!hasExistingCards || isImporting) && !pendingImport;
  const showDuplicateReview = !!pendingImport;

  /**
   * Entry point for BOTH the ImportPanel ("Add words" / first import)
   * and the Settings backup-restore upload. Runs duplicate detection
   * up front: if nothing duplicates, commit immediately (no extra
   * friction for the common case); if anything does, hold the batch in
   * `pendingImport` and show DuplicateReviewPanel so the learner
   * decides what to do BEFORE it touches state.
   */
  const handleIncomingCards = (newCards, mode) => {
    const { duplicates, unique } = checkForDuplicates(newCards);

    if (duplicates.length === 0) {
      commitCards(newCards, mode);
      return;
    }

    setPendingImport({ cards: newCards, duplicates, unique, mode });
  };

  /** Actually writes a batch of cards to state, via the right path for the mode. */
  const commitCards = (cardsToCommit, mode) => {
    if (mode === "restore") {
      restoreCards(cardsToCommit);
    } else if (hasExistingCards) {
      addCards(cardsToCommit);
    } else {
      importCards(cardsToCommit);
    }
    setActiveCategory(ALL_WORDS_CATEGORY);
    setActiveTag("all");
    setIsImporting(false);
  };

  const handleConfirmDuplicateReview = (skipIds) => {
    const { cards: allParsedCards, mode } = pendingImport;
    const cardsToCommit = allParsedCards.filter((c) => !skipIds.has(c.id));
    commitCards(cardsToCommit, mode);
    setPendingImport(null);
  };

  const handleCancelDuplicateReview = () => {
    setPendingImport(null);
  };

  // Keyboard shortcuts are only live while the study view (not an
  // import/settings panel) is showing, so typing in the import textarea
  // or a sidebar rename field never gets hijacked by Space/arrow keys.
  useKeyboardShortcuts({
    onFlip: toggleReveal,
    onNext: goNext,
    onPrevious: goPrevious,
    enabled: !showImportView && !showDuplicateReview && !isSettingsOpen,
  });

  return (
    <div className="paper-texture min-h-screen flex flex-col font-body">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-rule bg-paper">
        <div className="flex items-center gap-2">
          <span className="font-display font-semibold text-lg text-ink">
            Vocabulary Drawer
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!showImportView && !showDuplicateReview && (
            <button
              type="button"
              onClick={() => setIsImporting(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-rule text-ink/70 text-sm hover:border-ink/40 transition-colors"
            >
              <Plus size={15} />
              Add words
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
            className="p-2 rounded-sm border border-rule text-ink/70 hover:border-ink/40 transition-colors"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </header>

      {showDuplicateReview && (
        <main className="flex-1">
          <DuplicateReviewPanel
            duplicates={pendingImport.duplicates}
            uniqueCount={pendingImport.unique.length}
            onConfirm={handleConfirmDuplicateReview}
            onCancel={handleCancelDuplicateReview}
          />
        </main>
      )}

      {/* ImportPanel stays MOUNTED (just hidden) while duplicate review is
          showing on top of it for an 'import'-mode batch, rather than
          being unmounted — otherwise cancelling the review would wipe
          whatever text/format the learner had set up in the import
          form, forcing them to redo it. A 'restore'-mode duplicate
          review has no form underneath it to preserve, so ImportPanel
          simply isn't rendered in that case. */}
      {(showImportView || (showDuplicateReview && pendingImport.mode === "import")) && (
        <main className={`flex-1 ${showDuplicateReview ? "hidden" : ""}`}>
          <ImportPanel
            formatProfiles={formatProfiles}
            onSaveFormatProfile={saveFormatProfile}
            onDeleteFormatProfile={deleteFormatProfile}
            onImport={(newCards) => handleIncomingCards(newCards, "import")}
          />
        </main>
      )}

      {!showImportView && !showDuplicateReview && (
        <div className="flex flex-1 flex-col md:flex-row">
          <Sidebar
            categories={categories}
            activeCategory={activeCategory}
            activeTag={activeTag}
            onSelect={handleSelectCategory}
            getCounts={getCounts}
            tags={tags}
            onMergeCategory={mergeCategory}
            onAddTag={addCustomTag}
            onRenameTag={renameTag}
            onDeleteTag={deleteCustomTag}
          />

          <main className="flex-1 flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-md">
              <Flashcard
                card={currentCard}
                tags={tags}
                isRevealed={isRevealed}
                onToggleReveal={toggleReveal}
                onToggleTag={handleToggleTag}
              />
              <DeckControls
                currentIndex={currentIndex}
                deckLength={deckLength}
                onPrevious={goPrevious}
                onNext={goNext}
              />
              <p className="text-center font-mono text-[11px] text-ink/30 mt-3">
                Space to flip &middot; ← → to navigate
              </p>
            </div>
          </main>
        </div>
      )}

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSetting={updateSetting}
        onResetData={() => {
          resetAll();
          setIsSettingsOpen(false);
          setIsImporting(true);
        }}
        cards={cards}
        categories={categories}
        tags={tags}
        history={history}
        onClearHistory={clearHistory}
        onRestoreBackup={(restoredCards) => {
          setIsSettingsOpen(false);
          handleIncomingCards(restoredCards, "restore");
        }}
      />
    </div>
  );
}
