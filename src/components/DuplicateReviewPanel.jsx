/**
 * DuplicateReviewPanel.jsx
 * --------------------------
 * Shown after parsing/restoring a batch of cards, whenever
 * findDuplicates() (utils/duplicates.js) found one or more entries that
 * already match an existing card by word+meaning. Lets the learner see
 * exactly what would be skipped vs added before anything is committed
 * to state.
 *
 * Duplicates are pre-selected to be SKIPPED by default (the safer
 * default — avoids accidentally flooding a category with repeats), but
 * each one can be individually un-skipped ("add anyway") in case the
 * learner actually wants the repeat (e.g. they intentionally re-added
 * a word to a different category and don't mind the overlap).
 *
 * Props:
 *  - duplicates: [{ incoming, existing }] from findDuplicates()
 *  - uniqueCount: number of cards that had no duplicate (always added)
 *  - onConfirm: (skipIds: Set<string>) => void — ids of incoming cards to skip
 *  - onCancel: () => void
 */

import React, { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";

export default function DuplicateReviewPanel({ duplicates, uniqueCount, onConfirm, onCancel }) {
  // Every duplicate starts selected-to-skip (checked = "skip this one").
  const [skipIds, setSkipIds] = useState(() => new Set(duplicates.map((d) => d.incoming.id)));

  const toggleSkip = (id) => {
    setSkipIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const skipAll = () => setSkipIds(new Set(duplicates.map((d) => d.incoming.id)));
  const addAllAnyway = () => setSkipIds(new Set());

  const willAddCount = uniqueCount + (duplicates.length - skipIds.size);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-start gap-3 mb-5">
        <AlertTriangle size={20} className="text-accent flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="font-display font-semibold text-xl text-ink">
            {duplicates.length} possible duplicate{duplicates.length === 1 ? "" : "s"} found
          </h2>
          <p className="font-body text-sm text-ink/60 mt-1">
            These already exist with the same word and meaning. Different
            categories or examples don't count — only word + meaning are
            compared. Choose which ones to skip (default) or add anyway.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={skipAll}
          className="text-xs px-2.5 py-1 rounded-sm border border-rule text-ink/65 hover:border-ink/40"
        >
          Skip all
        </button>
        <button
          type="button"
          onClick={addAllAnyway}
          className="text-xs px-2.5 py-1 rounded-sm border border-rule text-ink/65 hover:border-ink/40"
        >
          Add all anyway
        </button>
      </div>

      <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto border border-rule rounded-sm p-2 bg-ink/[0.02]">
        {duplicates.map(({ incoming, existing }) => {
          const isSkipped = skipIds.has(incoming.id);
          return (
            <li
              key={incoming.id}
              className="flex items-start gap-3 px-2 py-2 rounded-sm bg-paper border border-rule"
            >
              <button
                type="button"
                onClick={() => toggleSkip(incoming.id)}
                aria-pressed={isSkipped}
                className={`mt-0.5 w-5 h-5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSkipped ? "bg-accent border-accent" : "border-rule"
                }`}
                aria-label={isSkipped ? "Will be skipped — click to add anyway" : "Will be added — click to skip"}
              >
                {isSkipped && <Check size={13} className="text-paper" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display font-medium text-ink">{incoming.word}</span>
                  <span className="text-ink/40 text-sm">— {incoming.meaning}</span>
                </div>
                <p className="text-[11px] text-ink/40 mt-0.5">
                  Already in "{existing.category}"
                  {isSkipped ? " — will be skipped" : " — will be added anyway"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between mt-5">
        <p className="text-sm text-ink/60 font-body">
          Will add <span className="font-medium text-ink">{willAddCount}</span> card
          {willAddCount === 1 ? "" : "s"}
          {skipIds.size > 0 && (
            <span className="text-ink/40"> (skipping {skipIds.size})</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-sm border border-rule text-sm text-ink/70 hover:border-ink/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(skipIds)}
            className="px-4 py-2 rounded-sm bg-accent text-paper text-sm font-medium hover:bg-accent/90"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
