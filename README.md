# Vocabulary Drawer — PDF-to-Flashcard Generator

A fully client-side flashcard app for language learners. No backend, no
API calls — vocabulary text is parsed in the browser (or ahead of time
with the included Python script), and all progress is saved to
`localStorage`.

## Setup

```bash
npm install
npm run dev      # local dev server
npm run build    # production build -> dist/
```

## Features

- **Multiple input formats** — numbered (`21. Word Meaning`), quoted
  (`"Word" "Meaning"`), colon (`Word : Meaning`), space-separated
  (`Word Meaning`), and three-line (`Word` / `Meaning` / `Example`).
  Pick one from the format panel in the import screen.
- **Custom regex format** — for anything the presets don't cover, write
  your own regex with named groups `(?<word>)` `(?<meaning>)` and
  optionally `(?<example>)` `(?<exampleMeaning>)`. Custom formats and
  regex patterns can be saved as named profiles for reuse.
- **File import** — paste text directly, or load a `.txt`, `.pdf`
  (text is extracted client-side), or `.json` file (already-structured
  cards, with some tolerance for alternate key names like `term`/
  `translation`).
- **Mergeable / renameable main categories** — use the ⋮ menu next to
  any category (except "All Words") to merge it into another category
  or just rename it.
- **Custom sub-categories (tags)** — beyond the built-in Difficult /
  Easy / Favorite / Done, add your own tags from any category's "+ New
  tag" control. Tags can be renamed; custom tags can also be deleted.
- **Multi-tagging** — a card can hold several tags at once (e.g. Easy +
  Done, or Favorite + Done). The one exception: Difficult and Easy are
  mutually exclusive — selecting one clears the other.
- **Keyboard navigation** — Space or Enter flips the active card,
  ArrowRight/ArrowLeft move to the next/previous card. Disabled
  automatically while typing in any text field.

## Project structure

```
parser.py                      Standalone Python parser (numbered text -> JSON)
src/
  utils/
    textParser.js               Client-side parser for the original numbered format
    formatProfiles.js           All format presets + custom regex engine
    fileImport.js                .txt / .pdf / .json file reading and normalization
    categoryTree.js              Categories, tags, multi-tag toggling, category merge
    storage.js                   localStorage read/write + old-data migration
  hooks/
    useFlashcards.js             Cards, tags, format profiles, marking engine, persistence
    useDeckNavigation.js         Active deck position, shuffle, reveal-reset
    useKeyboardShortcuts.js      Space/Enter to flip, arrows to navigate
  components/
    Sidebar.jsx                  Category "drawer" + tag sub-filters, category/tag management
    Flashcard.jsx                The interactive index-card (click-to-flip, multi-tag buttons)
    DeckControls.jsx             Previous / Next navigation
    SettingsPanel.jsx            Slide-in settings drawer
    ImportPanel.jsx              Format selection + paste/file import
  App.jsx                        Layout + wiring between the above
  main.jsx, index.css            Entry point + design tokens / global styles
tailwind.config.js               Color palette (paper/ink/rule/accent/sage/brass) + fonts
```

## How the data flows

1. **Parsing** (`formatProfiles.js`, built on `textParser.js` for the
   original format) turns raw text into a flat array of card objects:
   `{ id, category, word, meaning, example, exampleMeaning, statuses }`.
   `statuses` is an array, since a card can hold multiple tags at once.
2. **`categoryTree.js`** is the only place that knows how to turn that
   flat array into a navigable tree (categories → All/Difficult/Easy/
   Favorite/Done/custom tags). There is no separately-stored nested
   tree — every view is a filter over the same array, which is what
   makes tag updates appear consistently everywhere (e.g. a card tagged
   "Difficult" instantly shows up under both its own category's
   Difficult view *and* "All Words → Difficult"). `toggleCardTag()` also
   lives here, enforcing the Difficult/Easy exclusivity rule.
3. **`useFlashcards.js`** owns cards, the active tag list, format
   profiles, and settings; persists all of it to `localStorage` on
   every change; and exposes `toggleTag`, `mergeCategory`, `addCustomTag`,
   `renameTag`, and `deleteCustomTag` as the write paths for each kind
   of edit.
4. **`useDeckNavigation.js`** owns *where you are* in the currently
   filtered deck — separate from the data itself, since it needs to
   reset/reshuffle whenever you switch categories without touching the
   underlying cards.
5. **`useKeyboardShortcuts.js`** wires Space/Enter/arrow keys to the
   deck-navigation actions, guarded so it never fires while a text
   field (import textarea, rename input, regex pattern field) has focus.

## Using the Python parser instead

If you'd rather pre-process a large vocabulary file outside the browser
(numbered format only — for other formats, use the in-app presets or
regex mode):

```bash
python parser.py input.txt output.json
```

The resulting `.json` can then be loaded directly through the in-app
"Load .txt / .pdf / .json" button.

## Design notes

The visual language is a "card-catalog drawer": warm paper tones, a serif
(Fraunces) for the headword like a printed dictionary entry, monospace
(IBM Plex Mono) for catalog-style metadata, and a die-cut corner notch +
3D flip on the flashcard itself as the one deliberate signature flourish.
Colors and fonts are defined as tokens in `tailwind.config.js` — change
them there to retheme the whole app.
