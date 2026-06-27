/**
 * ImportPanel.jsx
 * ----------------
 * The import screen. Shown when there are no cards yet, or via "Add
 * words" later. Supports:
 *
 *  - Pasting raw text and parsing it with a chosen format (preset or
 *    custom regex) — see utils/formatProfiles.js.
 *  - Loading a .txt or .pdf file (text is extracted, then run through
 *    the same format pipeline as pasted text).
 *  - Loading a .json file that already contains structured cards (or
 *    a close variant — see utils/fileImport.js's normalizeJsonCards).
 *  - Saving a custom regex/preset choice as a named profile for reuse
 *    next time, and re-selecting a saved profile from a dropdown.
 *
 * Props:
 *  - onImport: (cards: Array) => void — called with the parsed array
 *  - formatProfiles: saved custom profiles (from useFlashcards)
 *  - onSaveFormatProfile: (profile) => void
 *  - onDeleteFormatProfile: (profileId) => void
 */

import React, { useState, useRef } from "react";
import { Upload, FileText, ChevronDown, Save, Trash2 } from "lucide-react";
import { parseWithProfile, PRESETS } from "../utils/formatProfiles";
import { readTextFile, extractPdfText, readJsonFile, getFileExtension } from "../utils/fileImport";

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

const REGEX_PLACEHOLDER = String.raw`(?<word>\w+)\s+(?<meaning>\w+)\n(?<example>[^\n]+)`;

export default function ImportPanel({
  onImport,
  formatProfiles = [],
  onSaveFormatProfile,
  onDeleteFormatProfile,
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [formatMode, setFormatMode] = useState("preset"); // 'preset' | 'regex'
  const [preset, setPreset] = useState("numbered");
  const [regexPattern, setRegexPattern] = useState("");
  const [regexFlags, setRegexFlags] = useState("m");
  const [showFormatPanel, setShowFormatPanel] = useState(false);
  const [saveProfileName, setSaveProfileName] = useState("");
  const fileInputRef = useRef(null);

  const activeProfile = { mode: formatMode, preset, pattern: regexPattern, flags: regexFlags };

  const applyProfile = (profile) => {
    setFormatMode(profile.mode);
    if (profile.mode === "preset") setPreset(profile.preset || "numbered");
    if (profile.mode === "regex") {
      setRegexPattern(profile.pattern || "");
      setRegexFlags(profile.flags || "m");
    }
  };

  const handleParseText = (rawText) => {
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
        // Let the user review/adjust before parsing, rather than
        // auto-parsing — PDF text extraction can need a quick glance.
        setError(null);
        return;
      }

      // .txt and anything else readable as plain text.
      const raw = await readTextFile(file);
      setText(raw);
      setError(null);
    } catch (err) {
      setError(err.message || "Could not read this file.");
    } finally {
      event.target.value = ""; // allow re-selecting the same file later
    }
  };

  const handleSaveProfile = () => {
    if (!saveProfileName.trim()) return;
    onSaveFormatProfile?.({ ...activeProfile, name: saveProfileName.trim() });
    setSaveProfileName("");
  };

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
          Input format:{" "}
          <span className="font-medium text-ink">
            {formatMode === "regex"
              ? "Custom regex"
              : PRESETS.find((p) => p.id === preset)?.label}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`transition-transform ${showFormatPanel ? "rotate-180" : ""}`}
        />
      </button>

      {showFormatPanel && (
        <div className="border border-rule rounded-sm p-4 mb-4 bg-ink/[0.02]">
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setFormatMode("preset")}
              className={`px-3 py-1.5 rounded-sm text-sm font-body border transition-colors ${
                formatMode === "preset"
                  ? "bg-accent text-paper border-accent"
                  : "border-rule text-ink/70 hover:border-ink/40"
              }`}
            >
              Preset format
            </button>
            <button
              type="button"
              onClick={() => setFormatMode("regex")}
              className={`px-3 py-1.5 rounded-sm text-sm font-body border transition-colors ${
                formatMode === "regex"
                  ? "bg-accent text-paper border-accent"
                  : "border-rule text-ink/70 hover:border-ink/40"
              }`}
            >
              Custom regex
            </button>
          </div>

          {formatMode === "preset" ? (
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
          ) : (
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
            formatMode === "preset" ? PRESET_PLACEHOLDERS[preset] : REGEX_PLACEHOLDER
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
