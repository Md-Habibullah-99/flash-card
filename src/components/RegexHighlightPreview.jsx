/**
 * RegexHighlightPreview.jsx
 * ---------------------------
 * Renders the user's pasted sample text with color-coded highlights
 * showing EXACTLY what the current format (Easy builder or Advanced
 * regex) is selecting as word / meaning / example / example
 * translation. This answers "what is my pattern actually picking up?"
 * directly, rather than only showing the final parsed result — seeing
 * the highlight land on the wrong word/substring is often the fastest
 * way for someone to realize their separator choice or regex is off.
 *
 * Uses utils/formatProfiles.js's getRegexMatchSpans(), which works off
 * the EXACT SAME pattern that will actually run on import — this is a
 * read-only inspection of that pattern, not a second implementation.
 *
 * Props:
 *  - sampleText: string — the raw text to highlight (the textarea content, or a placeholder)
 *  - pattern: string — the regex pattern currently in effect (already
 *    resolved from Easy/Preset/Advanced mode by the caller)
 *  - flags: string
 */

import React, { useMemo } from "react";
import { getRegexMatchSpans } from "../utils/formatProfiles";

const GROUP_STYLES = {
  word: "bg-accent/20 text-accent border-b-2 border-accent",
  meaning: "bg-sage/20 text-sage border-b-2 border-sage",
  example: "bg-brass/20 text-brass border-b-2 border-brass",
  exampleMeaning: "bg-ink/10 text-ink/70 border-b-2 border-ink/40",
};

const GROUP_LABELS = {
  word: "Word",
  meaning: "Meaning",
  example: "Example",
  exampleMeaning: "Example translation",
};

export default function RegexHighlightPreview({ sampleText, pattern, flags }) {
  const { segments, error, matchCount } = useMemo(() => {
    if (!pattern || !sampleText) {
      return { segments: [{ text: sampleText || "", group: null }], error: null, matchCount: 0 };
    }
    try {
      const spans = getRegexMatchSpans(sampleText, pattern, flags || "");
      return { segments: buildSegments(sampleText, spans), error: null, matchCount: spans.length };
    } catch (err) {
      return { segments: [{ text: sampleText, group: null }], error: err.message, matchCount: 0 };
    }
  }, [sampleText, pattern, flags]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-ink/40 uppercase tracking-wide">
          What your format is selecting
        </span>
        {!error && (
          <span className="text-[11px] text-ink/40">
            {matchCount} match{matchCount === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-xs text-accent bg-accent/5 px-2 py-1.5 rounded-sm">{error}</p>
      ) : (
        <>
          <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed bg-paper border border-rule rounded-sm p-3 max-h-48 overflow-y-auto">
            {segments.map((seg, i) =>
              seg.group ? (
                <mark
                  key={i}
                  title={GROUP_LABELS[seg.group] || seg.group}
                  className={`rounded-[2px] px-0.5 ${GROUP_STYLES[seg.group] || "bg-rule/40"}`}
                >
                  {seg.text}
                </mark>
              ) : (
                <span key={i} className="text-ink/30">
                  {seg.text}
                </span>
              )
            )}
          </pre>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {Object.entries(GROUP_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1 text-[11px] text-ink/50">
                <span className={`inline-block w-2.5 h-2.5 rounded-[2px] ${GROUP_STYLES[key].split(" ")[0]}`} />
                {label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Converts raw match spans into a flat, ordered list of text segments
 * ready to render: each segment is either plain (unmatched) text or a
 * single named-group's text. Gaps between and around matches are
 * preserved as plain segments so the FULL sample text is always shown,
 * with only the captured parts highlighted.
 */
function buildSegments(text, spans) {
  // Flatten every group span across every match into one sorted list
  // of non-overlapping ranges (named-group ranges never overlap each
  // other within a single sane regex, so a simple sort is sufficient).
  const ranges = [];
  for (const span of spans) {
    for (const [groupName, range] of Object.entries(span.groups)) {
      if (range) ranges.push({ ...range, group: groupName });
    }
  }
  ranges.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), group: null });
    }
    segments.push({ text: text.slice(range.start, range.end), group: range.group });
    cursor = Math.max(cursor, range.end);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), group: null });
  }

  return segments;
}
