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

import React, { useState, useMemo } from "react";
import { Settings as SettingsIcon, Plus } from "lucide-react";

import Sidebar from "./components/Sidebar";
import Flashcard from "./components/Flashcard";
import DeckControls from "./components/DeckControls";
import SettingsPanel from "./components/SettingsPanel";
import ImportPanel from "./components/ImportPanel";

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
  } = useFlashcards();

  const [activeCategory, setActiveCategory] = useState(ALL_WORDS_CATEGORY);
  const [activeTag, setActiveTag] = useState("all");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleSelectCategory = (category, tagId) => {
    setActiveCategory(category);
    setActiveTag(tagId);
  };

  const handleToggleTag = (tagId) => {
    if (currentCard) toggleTag(currentCard.id, tagId);
  };

  const getCounts = (category) => getTagCounts(cards, category, tags);

  const hasExistingCards = cards.length > 0;
  const showImportView = !hasExistingCards || isImporting;

  // Keyboard shortcuts are only live while the study view (not an
  // import/settings panel) is showing, so typing in the import textarea
  // or a sidebar rename field never gets hijacked by Space/arrow keys.
  useKeyboardShortcuts({
    onFlip: toggleReveal,
    onNext: goNext,
    onPrevious: goPrevious,
    enabled: !showImportView && !isSettingsOpen,
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
          {!showImportView && (
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

      {showImportView ? (
        <main className="flex-1">
          <ImportPanel
            formatProfiles={formatProfiles}
            onSaveFormatProfile={saveFormatProfile}
            onDeleteFormatProfile={deleteFormatProfile}
            onImport={(newCards) => {
              // If cards already exist, this was opened via "Add words" —
              // append instead of replacing, so existing progress survives.
              if (hasExistingCards) {
                addCards(newCards);
              } else {
                importCards(newCards);
              }
              setActiveCategory(ALL_WORDS_CATEGORY);
              setActiveTag("all");
              setIsImporting(false);
            }}
          />
        </main>
      ) : (
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
      />
    </div>
  );
}
