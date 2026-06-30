/**
 * ImportPanel.jsx
 * ----------------
 * The import screen. Shown when there are no cards yet, or via "Add
 * words" later. Supports:
 *
 *  - "Easy" format mode (default) — answer two plain-language
 *    questions ("what separates the word from its meaning?", "is
 *    there an example line?") and a regex is generated for you behind
 *    the scenes. No regex knowledge required. Includes a live preview
 *    that parses the first couple of lines as you type/choose.
 *  - "Preset" mode — pick one of five common fixed shapes directly.
 *  - "Advanced" mode — write your own regex with named groups, for
 *    formats the easy builder can't express.
 *  - Loading a .txt or .pdf file (text is extracted, then run through
 *    the same format pipeline as pasted text).
 *  - Loading a .json file that already contains structured cards.
 *  - Saving the current format (any of the three modes) as a named
 *    profile for reuse next time.
 *
 * Props:
 *  - onImport: (cards: Array) => void — called with the parsed array
 *  - formatProfiles: saved custom profiles (from useFlashcards)
 *  - onSaveFormatProfile: (profile) => void
 *  - onDeleteFormatProfile: (profileId) => void
 */

import React, { useState, useRef, useMemo } from "react";
import { Upload, FileText, ChevronDown, Save, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { parseWithProfile, PRESETS } from "../utils/formatProfiles";
import { readTextFile, extractPdfText, readJsonFile, getFileExtension } from "../utils/fileImport";
import { SEPARATOR_OPTIONS, buildEasyProfile, describeEasyProfile } from "../utils/easyFormatBuilder";
import RegexHighlightPreview from "./RegexHighlightPreview";

const PRESET_PLACEHOLDERS = {
  numbered: `BASIC TURKISH NOUNS AND ADJECTIVES
21. Evet Yes
Evet, biliyorum. Yes, I know.`,
  "quoted-space": `BASIC TURKISH NOUNS AND ADJECTIVES
"Evet" "Yes"
"Evet, biliyorum." "Yes, I know."`,
  colon: `BASIC TURKISH NOUNS AND ADJECTIVES
Evet : Yes
Evet, biliyorum. : Yes, I know.`,
  "space-pair": `BASIC TURKISH NOUNS AND ADJECTIVES
Evet Yes
Evet, biliyorum. Yes, I know.`,
  "three-line": `BASIC TURKISH NOUNS AND ADJECTIVES
Evet
Yes
Evet, biliyorum.`,
};

const EASY_PLACEHOLDER = `BASIC TURKISH NOUNS AND ADJECTIVES
Evet Yes
Evet, biliyorum. Yes, I know.`;

const REGEX_PLACEHOLDER = String.raw`(?<word>\w+)\s+(?<meaning>\w+)\n(?<example>[^\n]+)`;

/** Small radio-style chip used for separator choices in the Easy builder. */
function SeparatorChips({ value, customValue, onChange, onCustomChange, idPrefix }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SEPARATOR_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`px-2.5 py-1 rounded-full text-xs font-body border transition-colors ${
            value === opt.id
              ? "bg-accent text-paper border-accent"
              : "border-rule text-ink/70 hover:border-ink/40"
          }`}
        >
          {opt.display}
        </button>
      ))}
      {value === "custom" && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="type it here, e.g. ::"
          maxLength={6}
          className={`px-2 py-1 rounded-full text-xs font-mono border w-32 focus:outline-none ${idPrefix}`}
          style={{ borderColor: "#C9BCA3" }}
        />
      )}
    </div>
  );
}

export default function ImportPanel({
  onImport,
  formatProfiles = [],
  onSaveFormatProfile,
  onDeleteFormatProfile,
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [formatMode, setFormatMode] = useState("easy"); // 'easy' | 'preset' | 'regex'
  const [preset, setPreset] = useState("numbered");
  const [regexPattern, setRegexPattern] = useState("");
  const [regexFlags, setRegexFlags] = useState("m");
  const [showFormatPanel, setShowFormatPanel] = useState(true);
  const [saveProfileName, setSaveProfileName] = useState("");
  const fileInputRef = useRef(null);

  // Easy-builder answers
  const [wordSeparatorId, setWordSeparatorId] = useState("space");
  const [wordCustomValue, setWordCustomValue] = useState("");
  const [hasExampleLine, setHasExampleLine] = useState(true);
  const [sameExampleSeparator, setSameExampleSeparator] = useState(true);
  const [exampleSeparatorId, setExampleSeparatorId] = useState("space");
  const [exampleCustomValue, setExampleCustomValue] = useState("");

  const easyAnswers = {
    wordSeparatorId,
    wordCustomValue,
    hasExampleLine,
    exampleSeparatorId: sameExampleSeparator ? wordSeparatorId : exampleSeparatorId,
    exampleCustomValue: sameExampleSeparator ? wordCustomValue : exampleCustomValue,
  };

  // Builds the actual profile to run, depending on which mode is active.
  const activeProfile = useMemo(() => {
    if (formatMode === "easy") {
      try {
        return buildEasyProfile(easyAnswers);
      } catch {
        return null; // not enough info yet (e.g. custom separator left blank)
      }
    }
    if (formatMode === "regex") {
      return { mode: "regex", pattern: regexPattern, flags: regexFlags };
    }
    return { mode: "preset", preset };
  }, [formatMode, easyAnswers, regexPattern, regexFlags, preset]);

  // Live preview: try parsing just the textarea's content (or, if it's
  // empty, the relevant placeholder) so the learner can see whether
  // their format choice actually works BEFORE clicking the main button.
  const previewSource = text.trim()
    ? text
    : formatMode === "easy"
    ? EASY_PLACEHOLDER
    : formatMode === "preset"
    ? PRESET_PLACEHOLDERS[preset]
    : "";

  const preview = useMemo(() => {
    if (!activeProfile || !previewSource) return { ok: false, cards: [], error: null };
    try {
      const cards = parseWithProfile(previewSource, activeProfile);
      return { ok: true, cards: cards.slice(0, 3), error: null };
    } catch (err) {
      return { ok: false, cards: [], error: err.message };
    }
  }, [activeProfile, previewSource]);

  const applyProfile = (profile) => {
    if (profile.mode === "easy") {
      setFormatMode("easy");
      setWordSeparatorId(profile.wordSeparatorId || "space");
      setWordCustomValue(profile.wordCustomValue || "");
      setHasExampleLine(!!profile.hasExampleLine);
      const sameSep = !profile.exampleSeparatorId || profile.exampleSeparatorId === profile.wordSeparatorId;
      setSameExampleSeparator(sameSep);
      setExampleSeparatorId(profile.exampleSeparatorId || profile.wordSeparatorId || "space");
      setExampleCustomValue(profile.exampleCustomValue || "");
      return;
    }
    setFormatMode(profile.mode);
    if (profile.mode === "preset") setPreset(profile.preset || "numbered");
    if (profile.mode === "regex") {
      setRegexPattern(profile.pattern || "");
      setRegexFlags(profile.flags || "m");
    }
  };

  const handleParseText = (rawText) => {
    if (!activeProfile) {
      setError("Finish setting up the format first.");
      return;
    }
    try {
      const cards = parseWithProfile(rawText, activeProfile);
      setError(null);
      onImport(cards);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleParseClick = () => handleParseText(text);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = getFileExtension(file);

    try {
      if (extension === "json") {
        const cards = await readJsonFile(file);
        setError(null);
        onImport(cards);
        return;
      }

      if (extension === "pdf") {
        const extracted = await extractPdfText(file);
        setText(extracted);
        setError(null);
        return;
      }

      const raw = await readTextFile(file);
      setText(raw);
      setError(null);
    } catch (err) {
      setError(err.message || "Could not read this file.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSaveProfile = () => {
    if (!saveProfileName.trim()) return;
    const profileToSave =
      formatMode === "easy"
        ? { mode: "easy", ...easyAnswers, name: saveProfileName.trim() }
        : { ...activeProfile, name: saveProfileName.trim() };
    onSaveFormatProfile?.(profileToSave);
    setSaveProfileName("");
  };

  const currentFormatSummary =
    formatMode === "regex"
      ? "Advanced (custom regex)"
      : formatMode === "preset"
      ? PRESETS.find((p) => p.id === preset)?.label
      : describeEasyProfile(easyAnswers);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="text-center mb-6">
        <h1 className="font-display font-semibold text-3xl text-ink">
          Build your word drawer
        </h1>
        <p className="font-body text-ink/60 mt-2 text-sm">
          Paste vocabulary text, or load a .txt, .pdf, or .json file.
        </p>
      </div>

      {/* Format selector toggle */}
      <button
        type="button"
        onClick={() => setShowFormatPanel((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 mb-2 rounded-sm border border-rule text-sm text-ink/75 hover:border-ink/40 transition-colors"
      >
        <span className="font-body">
          Input format: <span className="font-medium text-ink">{currentFormatSummary}</span>
        </span>
        <ChevronDown
          size={15}
          className={`transition-transform ${showFormatPanel ? "rotate-180" : ""}`}
        />
      </button>

      {showFormatPanel && (
        <div className="border border-rule rounded-sm p-4 mb-4 bg-ink/[0.02]">
          <div className="flex gap-2 mb-3">
            {[
              { id: "easy", label: "Easy (no regex)" },
              { id: "preset", label: "Preset" },
              { id: "regex", label: "Advanced" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setFormatMode(m.id)}
                className={`px-3 py-1.5 rounded-sm text-sm font-body border transition-colors ${
                  formatMode === m.id
                    ? "bg-accent text-paper border-accent"
                    : "border-rule text-ink/70 hover:border-ink/40"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* ----- EASY MODE: plain-language questions, no regex shown ----- */}
          {formatMode === "easy" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-ink/50 -mt-1">
                Answer two quick questions about how your list is laid out — no
                code needed. Each entry should look like:{" "}
                <span className="font-mono text-[11px] bg-ink/[0.06] px-1 rounded">
                  Word [separator] Meaning
                </span>
              </p>

              <div>
                <label className="text-sm font-body font-medium text-ink block mb-1.5">
                  1. What separates the word from its meaning?
                </label>
                <SeparatorChips
                  value={wordSeparatorId}
                  customValue={wordCustomValue}
                  onChange={setWordSeparatorId}
                  onCustomChange={setWordCustomValue}
                  idPrefix="word-sep"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-body font-medium text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasExampleLine}
                    onChange={(e) => setHasExampleLine(e.target.checked)}
                  />
                  2. Does each word have an example sentence on the next line?
                </label>

                {hasExampleLine && (
                  <div className="mt-2 ml-6 flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-xs text-ink/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameExampleSeparator}
                        onChange={(e) => setSameExampleSeparator(e.target.checked)}
                      />
                      The example line uses the same separator
                    </label>
                    {!sameExampleSeparator && (
                      <SeparatorChips
                        value={exampleSeparatorId}
                        customValue={exampleCustomValue}
                        onChange={setExampleSeparatorId}
                        onCustomChange={setExampleCustomValue}
                        idPrefix="example-sep"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----- PRESET MODE ----- */}
          {formatMode === "preset" && (
            <div className="flex flex-col gap-1.5">
              {PRESETS.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-start gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-sm ${
                    preset === p.id ? "bg-accent/10" : "hover:bg-ink/[0.03]"
                  }`}
                >
                  <input
                    type="radio"
                    name="preset"
                    className="mt-1"
                    checked={preset === p.id}
                    onChange={() => setPreset(p.id)}
                  />
                  <span>
                    <span className="font-mono text-[12px] text-ink block">{p.label}</span>
                    <span className="text-ink/50 text-xs">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* ----- ADVANCED / REGEX MODE ----- */}
          {formatMode === "regex" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-body text-ink/60">
                Regex pattern — use named groups{" "}
                <code className="font-mono text-[11px] bg-ink/[0.06] px-1 rounded">
                  (?&lt;word&gt;) (?&lt;meaning&gt;)
                </code>{" "}
                required, plus optional{" "}
                <code className="font-mono text-[11px] bg-ink/[0.06] px-1 rounded">
                  (?&lt;example&gt;) (?&lt;exampleMeaning&gt;)
                </code>
                . Most people won't need this — try "Easy" above first.
              </label>
              <input
                type="text"
                value={regexPattern}
                onChange={(e) => setRegexPattern(e.target.value)}
                placeholder={REGEX_PLACEHOLDER}
                className="w-full bg-paper border border-rule rounded-sm px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:border-accent"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs font-body text-ink/60">Flags:</label>
                <input
                  type="text"
                  value={regexFlags}
                  onChange={(e) => setRegexFlags(e.target.value)}
                  placeholder="m"
                  className="w-20 bg-paper border border-rule rounded-sm px-2 py-1 font-mono text-xs text-ink focus:outline-none focus:border-accent"
                />
                <span className="text-[11px] text-ink/40">
                  (the global flag is always applied automatically)
                </span>
              </div>
            </div>
          )}

          {/* ----- VISUAL HIGHLIGHT: shows exactly what's being selected, for Easy + Advanced modes ----- */}
          {activeProfile?.mode === "regex" && (
            <div className="mt-4 pt-3 border-t border-rule">
              <RegexHighlightPreview
                sampleText={previewSource}
                pattern={activeProfile.pattern}
                flags={activeProfile.flags}
              />
            </div>
          )}

          {/* ----- LIVE PREVIEW (shown for all three modes) ----- */}
          <div className="mt-4 pt-3 border-t border-rule">
            <span className="text-[11px] text-ink/40 uppercase tracking-wide block mb-1.5">
              Parsed result {text.trim() ? "" : "(using example text below)"}
            </span>
            {preview.ok ? (
              <div className="flex flex-col gap-1">
                {preview.cards.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 text-xs font-mono bg-sage/10 text-ink/80 px-2 py-1 rounded-sm"
                  >
                    <CheckCircle2 size={12} className="text-sage flex-shrink-0" />
                    <span className="font-semibold">{c.word || "—"}</span>
                    <span className="text-ink/40">→</span>
                    <span>{c.meaning || "—"}</span>
                    {c.example && <span className="text-ink/40 truncate">· {c.example}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 text-xs text-accent bg-accent/5 px-2 py-1.5 rounded-sm">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  {preview.error ||
                    "Finish the questions above to see a preview, or paste your real text below."}
                </span>
              </div>
            )}
          </div>

          {/* Save current format as a reusable profile */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-rule">
            <input
              type="text"
              value={saveProfileName}
              onChange={(e) => setSaveProfileName(e.target.value)}
              placeholder="Save this format as…"
              className="flex-1 min-w-0 bg-paper border border-rule rounded-sm px-2 py-1.5 text-xs text-ink focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={handleSaveProfile}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm border border-rule text-xs text-ink/70 hover:border-ink/40"
            >
              <Save size={12} />
              Save
            </button>
          </div>

          {formatProfiles.length > 0 && (
            <div className="flex flex-col gap-1 mt-3">
              <span className="text-[11px] text-ink/40 uppercase tracking-wide">
                Saved formats
              </span>
              {formatProfiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-2 py-1 rounded-sm hover:bg-ink/[0.03]"
                >
                  <button
                    type="button"
                    onClick={() => applyProfile(p)}
                    className="text-xs font-body text-ink/75 hover:text-accent text-left flex-1"
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteFormatProfile?.(p.id)}
                    aria-label={`Delete ${p.name}`}
                    className="p-1 text-ink/30 hover:text-accent"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-paper border border-rule rounded-sm p-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            formatMode === "easy"
              ? EASY_PLACEHOLDER
              : formatMode === "preset"
              ? PRESET_PLACEHOLDERS[preset]
              : REGEX_PLACEHOLDER
          }
          rows={12}
          className="w-full resize-none bg-transparent px-4 py-3 font-mono text-sm text-ink placeholder:text-ink/30 focus:outline-none"
        />
      </div>

      {error && (
        <p className="font-body text-sm text-accent mt-2" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button
          type="button"
          onClick={handleParseClick}
          className="flex items-center gap-2 bg-accent text-paper px-4 py-2 rounded-sm font-body text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <FileText size={15} />
          Parse into flashcards
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 border border-rule text-ink/70 px-4 py-2 rounded-sm font-body text-sm hover:border-ink/40 transition-colors"
        >
          <Upload size={15} />
          Load .txt / .pdf / .json
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
