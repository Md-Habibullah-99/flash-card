/**
 * SettingsPanel.jsx
 * ------------------
 * A slide-in panel (not a modal) so opening settings feels like pulling
 * open a drawer rather than an interruption — consistent with the
 * catalog-drawer metaphor used throughout the app.
 *
 * Sections:
 *  - Study preferences (reset-on-navigation, audio placeholder, shuffle)
 *  - Export — download the word list as .txt or .json, scoped to
 *    All Words, a single category, or "no category" (grouped by
 *    sub-category/tag instead). See utils/exportWords.js.
 *  - Restore — upload a previously exported .txt/.json file to bring
 *    cards (with their original category and tags) back. Goes through
 *    duplicate review in App.jsx before anything is actually added.
 *    See utils/backupImport.js.
 *  - History — the last 30 distinct words viewed, most recent first,
 *    with a way to clear it.
 *  - Reset Data
 *
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - settings: { resetMeaningOnNavigation, audioEnabled, shuffleMode }
 *  - onUpdateSetting: (key, value) => void
 *  - onResetData: () => void
 *  - cards: full card array (for export)
 *  - categories: string[] from getCategoryList() (for the export scope picker)
 *  - tags: active real tag list (for export + restore + history display)
 *  - history: [{cardId, word, meaning, category, viewedAt}], most recent first
 *  - onClearHistory: () => void
 *  - onRestoreBackup: (cards: Array) => void — called with parsed cards from an uploaded backup file
 */

import React, { useState, useRef } from "react";
import {
  X,
  Volume2,
  Shuffle,
  RotateCcw,
  Trash2,
  Download,
  Upload,
  History as HistoryIcon,
  AlertCircle,
} from "lucide-react";
import {
  EXPORT_SCOPES,
  buildTextExport,
  buildJsonExport,
  suggestExportFilename,
  downloadTextFile,
} from "../utils/exportWords";
import { parseBackupFile } from "../utils/backupImport";
import { ALL_WORDS_CATEGORY } from "../utils/categoryTree";

export default function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onUpdateSetting,
  onResetData,
  cards = [],
  categories = [],
  tags = [],
  history = [],
  onClearHistory,
  onRestoreBackup,
}) {
  const [exportScope, setExportScope] = useState(EXPORT_SCOPES.ALL);
  const [showHistory, setShowHistory] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const restoreFileInputRef = useRef(null);

  // Real category names only (exclude the "All Words" pseudo-category,
  // since that's already covered by the ALL scope option).
  const realCategories = categories.filter((c) => c !== ALL_WORDS_CATEGORY);

  const handleExport = (format) => {
    const filename = suggestExportFilename(exportScope, format);
    if (format === "json") {
      const data = buildJsonExport(cards, exportScope, tags);
      downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json");
    } else {
      const text = buildTextExport(cards, exportScope, tags);
      downloadTextFile(filename, text, "text/plain");
    }
  };

  const handleRestoreFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const restoredCards = parseBackupFile(file.name, text, tags);
      setRestoreError(null);
      onRestoreBackup?.(restoredCards);
    } catch (err) {
      setRestoreError(err.message || "Could not read this backup file.");
    } finally {
      event.target.value = ""; // allow re-selecting the same file later
    }
  };

  return (
    <>
      {/* Backdrop — click to dismiss, like closing a drawer */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 bg-ink/30 transition-opacity z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        role="dialog"
        aria-label="Settings"
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-paper border-l border-rule z-50 shadow-xl transition-transform duration-300 overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule sticky top-0 bg-paper z-10">
          <h2 className="font-display font-semibold text-xl text-ink">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 rounded-sm hover:bg-ink/[0.06] text-ink/60"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-6">
          {/* ----- Study preferences ----- */}
          <div className="flex flex-col gap-5">
            <ToggleRow
              Icon={RotateCcw}
              title="Reset meaning on navigation"
              description="Hide the translation again whenever you move to the next or previous card."
              checked={settings.resetMeaningOnNavigation}
              onChange={(value) => onUpdateSetting("resetMeaningOnNavigation", value)}
            />

            <ToggleRow
              Icon={Volume2}
              title="Audio pronunciation"
              description="Placeholder for text-to-speech playback — coming soon."
              checked={settings.audioEnabled}
              onChange={(value) => onUpdateSetting("audioEnabled", value)}
            />

            <ToggleRow
              Icon={Shuffle}
              title="Shuffle mode"
              description="Randomize the card order within whatever category you're viewing."
              checked={settings.shuffleMode}
              onChange={(value) => onUpdateSetting("shuffleMode", value)}
            />
          </div>

          {/* ----- Export ----- */}
          <div className="pt-5 border-t border-rule">
            <div className="flex items-center gap-2 mb-3">
              <Download size={16} className="text-ink/50" />
              <h3 className="font-body text-sm font-medium text-ink">Export word list</h3>
            </div>

            <label className="text-xs text-ink/60 block mb-1.5">What to include</label>
            <select
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value)}
              className="w-full bg-paper border border-rule rounded-sm px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-accent mb-3"
            >
              <option value={EXPORT_SCOPES.ALL}>All words (grouped by category)</option>
              {realCategories.map((category) => (
                <option key={category} value={category}>
                  Just "{category}"
                </option>
              ))}
              <option value={EXPORT_SCOPES.NO_CATEGORY}>
                All words, no category (grouped by tag instead)
              </option>
            </select>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleExport("txt")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm border border-rule text-sm text-ink/75 hover:border-ink/40 transition-colors"
              >
                <Download size={13} />
                .txt
              </button>
              <button
                type="button"
                onClick={() => handleExport("json")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm border border-rule text-sm text-ink/75 hover:border-ink/40 transition-colors"
              >
                <Download size={13} />
                .json
              </button>
            </div>

            {exportScope === EXPORT_SCOPES.NO_CATEGORY && (
              <p className="text-[11px] text-ink/40 mt-2 flex items-start gap-1.5">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                For a backup you plan to restore later, "All words (grouped
                by category)" is the safer choice — this grouping can't
                always tell categories and tags apart when restored.
              </p>
            )}
          </div>

          {/* ----- Restore from backup ----- */}
          <div className="pt-5 border-t border-rule">
            <div className="flex items-center gap-2 mb-2">
              <Upload size={16} className="text-ink/50" />
              <h3 className="font-body text-sm font-medium text-ink">Restore from backup</h3>
            </div>
            <p className="text-xs text-ink/50 mb-3">
              Upload a .txt or .json file you previously exported from here
              to bring those words — and their categories and tags — back.
            </p>
            <button
              type="button"
              onClick={() => restoreFileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm border border-rule text-sm text-ink/75 hover:border-ink/40 transition-colors"
            >
              <Upload size={13} />
              Choose backup file
            </button>
            <input
              ref={restoreFileInputRef}
              type="file"
              accept=".txt,.json"
              onChange={handleRestoreFileChange}
              className="hidden"
            />
            {restoreError && (
              <p className="text-xs text-accent mt-2" role="alert">
                {restoreError}
              </p>
            )}
          </div>

          {/* ----- History ----- */}
          <div className="pt-5 border-t border-rule">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <span className="flex items-center gap-2">
                <HistoryIcon size={16} className="text-ink/50" />
                <h3 className="font-body text-sm font-medium text-ink">
                  Recently viewed ({history.length})
                </h3>
              </span>
              <span className="text-xs text-ink/40">{showHistory ? "Hide" : "Show"}</span>
            </button>

            {showHistory && (
              <div className="mt-3 flex flex-col gap-3">
                {history.length === 0 ? (
                  <p className="text-xs text-ink/40">
                    Nothing viewed yet — words you study will show up here.
                  </p>
                ) : (
                  <>
                    <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                      {history.map((entry) => (
                        <li
                          key={entry.cardId}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm hover:bg-ink/[0.03] text-sm"
                        >
                          <span className="flex items-baseline gap-1.5 min-w-0">
                            <span className="font-display font-medium text-ink truncate">
                              {entry.word}
                            </span>
                            <span className="text-ink/40 text-xs truncate">{entry.meaning}</span>
                          </span>
                          <span className="font-mono text-[10px] text-ink/30 flex-shrink-0">
                            {formatRelativeTime(entry.viewedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="text-xs text-ink/50 hover:text-accent text-left"
                    >
                      Clear history
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ----- Reset data ----- */}
          <div className="pt-5 border-t border-rule">
            <button
              type="button"
              onClick={onResetData}
              className="flex items-center gap-2 text-sm text-accent font-body hover:underline"
            >
              <Trash2 size={14} />
              Clear all cards and progress
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function ToggleRow({ Icon, title, description, checked, onChange }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={18} className="text-ink/50 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="font-body text-sm font-medium text-ink">{title}</span>
          <Switch checked={checked} onChange={onChange} label={title} />
        </div>
        <p className="font-body text-xs text-ink/50 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

/** A small accessible toggle switch, styled to match the ink/accent palette. */
function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-accent" : "bg-rule"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-paper transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/** Formats an ISO timestamp as a short relative string ("2m ago", "3h ago", "5d ago"). */
function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
