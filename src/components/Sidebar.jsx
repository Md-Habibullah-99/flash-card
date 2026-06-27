/**
 * Sidebar.jsx
 * ------------
 * The "card-catalog drawer" navigation. Top level = categories (with
 * "All Words" pinned first), each expandable to show its tag sub-views
 * (All / Difficult / Easy / Favorite / Done / any custom tags) with
 * live counts.
 *
 * Category management: every category except "All Words" has a small
 * overflow menu for merging it into another existing category (or
 * renaming it, by "merging" into a brand-new name).
 *
 * Tag management: each expanded category's tag list ends with an
 * "+ New tag" control; custom tags additionally show rename/delete
 * controls. Built-in tags (Difficult/Easy/Favorite/Done) can be
 * renamed but not deleted, since the marking engine relies on their ids.
 *
 * Props:
 *  - categories: string[] — from getCategoryList()
 *  - activeCategory, activeTag: the current selection
 *  - onSelect: (category, tagId) => void
 *  - getCounts: (category) => { all, [tagId]: count, ... }
 *  - tags: the full active tag list, each { id, label, builtIn }
 *  - onMergeCategory: (fromCategory, toCategory) => void
 *  - onAddTag: (label) => void
 *  - onRenameTag: (tagId, newLabel) => void
 *  - onDeleteTag: (tagId) => void
 */

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Library,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { tagLabel, ALL_WORDS_CATEGORY } from "../utils/categoryTree";

export default function Sidebar({
  categories,
  activeCategory,
  activeTag,
  onSelect,
  getCounts,
  tags,
  onMergeCategory,
  onAddTag,
  onRenameTag,
  onDeleteTag,
}) {
  // Tracks which category drawers are expanded. "All Words" starts open
  // since it's almost always the first thing a learner browses.
  const [expanded, setExpanded] = useState({ [ALL_WORDS_CATEGORY]: true });
  const [categoryMenuOpenFor, setCategoryMenuOpenFor] = useState(null);
  const [mergeTargetFor, setMergeTargetFor] = useState(null); // category currently being merged/renamed
  const [mergeInputValue, setMergeInputValue] = useState("");
  const [addingTagFor, setAddingTagFor] = useState(null); // category currently adding a new tag (any category triggers global add)
  const [newTagLabel, setNewTagLabel] = useState("");
  const [renamingTagId, setRenamingTagId] = useState(null);
  const [renameTagValue, setRenameTagValue] = useState("");

  const toggleExpanded = (category) => {
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const startMerge = (category) => {
    setMergeTargetFor(category);
    setMergeInputValue("");
    setCategoryMenuOpenFor(null);
  };

  const confirmMerge = () => {
    if (mergeTargetFor && mergeInputValue.trim()) {
      onMergeCategory(mergeTargetFor, mergeInputValue.trim());
    }
    setMergeTargetFor(null);
    setMergeInputValue("");
  };

  const startAddTag = (category) => {
    setAddingTagFor(category);
    setNewTagLabel("");
  };

  const confirmAddTag = () => {
    if (newTagLabel.trim()) onAddTag(newTagLabel.trim());
    setAddingTagFor(null);
    setNewTagLabel("");
  };

  const startRenameTag = (tag) => {
    setRenamingTagId(tag.id);
    setRenameTagValue(tag.label);
  };

  const confirmRenameTag = () => {
    if (renamingTagId && renameTagValue.trim()) {
      onRenameTag(renamingTagId, renameTagValue.trim());
    }
    setRenamingTagId(null);
    setRenameTagValue("");
  };

  return (
    <nav
      aria-label="Flashcard categories"
      className="w-full md:w-72 flex-shrink-0 border-r border-rule bg-paper md:h-full overflow-y-auto"
    >
      <div className="px-4 py-4 flex items-center gap-2 border-b border-rule">
        <Library size={18} className="text-accent" strokeWidth={2.2} />
        <span className="font-display font-semibold text-ink text-lg">Word Drawer</span>
      </div>

      <ul className="py-2">
        {categories.map((category) => {
          const isOpen = !!expanded[category];
          const isCategoryActive = activeCategory === category;
          const counts = getCounts(category);
          const isMergingThis = mergeTargetFor === category;
          const canManageCategory = category !== ALL_WORDS_CATEGORY;

          return (
            <li key={category} className="px-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleExpanded(category)}
                  className={`flex-1 flex items-center justify-between gap-2 px-2 py-2 rounded-sm text-left font-body text-sm transition-colors min-w-0 ${
                    isCategoryActive ? "text-accent" : "text-ink/85"
                  } hover:bg-ink/[0.04]`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {isOpen ? (
                      <ChevronDown size={14} className="flex-shrink-0 opacity-60" />
                    ) : (
                      <ChevronRight size={14} className="flex-shrink-0 opacity-60" />
                    )}
                    <span
                      className={`truncate ${
                        category === ALL_WORDS_CATEGORY ? "font-semibold" : ""
                      }`}
                    >
                      {category}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-ink/40 flex-shrink-0">
                    {counts.all}
                  </span>
                </button>

                {canManageCategory && (
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryMenuOpenFor((prev) => (prev === category ? null : category))
                      }
                      aria-label={`Manage ${category}`}
                      className="p-1.5 rounded-sm text-ink/40 hover:text-ink/70 hover:bg-ink/[0.04]"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {categoryMenuOpenFor === category && (
                      <div className="absolute right-0 top-full mt-1 z-20 bg-paper border border-rule rounded-sm shadow-md py-1 w-44">
                        <button
                          type="button"
                          onClick={() => startMerge(category)}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-ink/80 hover:bg-ink/[0.05] flex items-center gap-2"
                        >
                          <Pencil size={12} />
                          Rename / merge into…
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isMergingThis && (
                <div className="ml-7 mb-2 flex items-center gap-1.5">
                  <input
                    autoFocus
                    type="text"
                    value={mergeInputValue}
                    onChange={(e) => setMergeInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmMerge();
                      if (e.key === "Escape") setMergeTargetFor(null);
                    }}
                    placeholder="New or existing category name"
                    className="flex-1 min-w-0 bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] text-ink focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={confirmMerge}
                    aria-label="Confirm"
                    className="p-1 rounded-sm text-sage hover:bg-sage/10"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergeTargetFor(null)}
                    aria-label="Cancel"
                    className="p-1 rounded-sm text-ink/40 hover:bg-ink/[0.05]"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {isOpen && (
                <ul className="ml-5 mb-1 border-l border-rule pl-2">
                  <li>
                    <button
                      type="button"
                      onClick={() => onSelect(category, "all")}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-sm font-body text-[13px] transition-colors ${
                        isCategoryActive && activeTag === "all"
                          ? "bg-accent/10 text-accent font-medium"
                          : "text-ink/65 hover:bg-ink/[0.04]"
                      }`}
                    >
                      <span>{tagLabel("all")}</span>
                      <span className="font-mono text-[11px] text-ink/35">{counts.all}</span>
                    </button>
                  </li>

                  {tags.map((tag) => {
                    const isActive = isCategoryActive && activeTag === tag.id;
                    const isRenamingThis = renamingTagId === tag.id;

                    if (isRenamingThis) {
                      return (
                        <li key={tag.id} className="flex items-center gap-1.5 px-1 py-1">
                          <input
                            autoFocus
                            type="text"
                            value={renameTagValue}
                            onChange={(e) => setRenameTagValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") confirmRenameTag();
                              if (e.key === "Escape") setRenamingTagId(null);
                            }}
                            className="flex-1 min-w-0 bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] text-ink focus:outline-none focus:border-accent"
                          />
                          <button
                            type="button"
                            onClick={confirmRenameTag}
                            aria-label="Confirm rename"
                            className="p-1 rounded-sm text-sage hover:bg-sage/10"
                          >
                            <Check size={13} />
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li key={tag.id} className="group flex items-center">
                        <button
                          type="button"
                          onClick={() => onSelect(category, tag.id)}
                          className={`flex-1 min-w-0 flex items-center justify-between px-2 py-1.5 rounded-sm font-body text-[13px] transition-colors ${
                            isActive
                              ? "bg-accent/10 text-accent font-medium"
                              : "text-ink/65 hover:bg-ink/[0.04]"
                          }`}
                        >
                          <span className="truncate">{tag.label}</span>
                          <span className="font-mono text-[11px] text-ink/35 flex-shrink-0 ml-2">
                            {counts[tag.id] ?? 0}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startRenameTag(tag)}
                          aria-label={`Rename ${tag.label}`}
                          className="opacity-0 group-hover:opacity-100 p-1 text-ink/30 hover:text-ink/60 flex-shrink-0"
                        >
                          <Pencil size={11} />
                        </button>
                        {!tag.builtIn && (
                          <button
                            type="button"
                            onClick={() => onDeleteTag(tag.id)}
                            aria-label={`Delete ${tag.label}`}
                            className="opacity-0 group-hover:opacity-100 p-1 text-ink/30 hover:text-accent flex-shrink-0"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </li>
                    );
                  })}

                  {addingTagFor === category ? (
                    <li className="flex items-center gap-1.5 px-1 py-1">
                      <input
                        autoFocus
                        type="text"
                        value={newTagLabel}
                        onChange={(e) => setNewTagLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmAddTag();
                          if (e.key === "Escape") setAddingTagFor(null);
                        }}
                        placeholder="New tag name"
                        className="flex-1 min-w-0 bg-paper border border-rule rounded-sm px-2 py-1 text-[13px] text-ink focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={confirmAddTag}
                        aria-label="Confirm new tag"
                        className="p-1 rounded-sm text-sage hover:bg-sage/10"
                      >
                        <Check size={13} />
                      </button>
                    </li>
                  ) : (
                    <li>
                      <button
                        type="button"
                        onClick={() => startAddTag(category)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-sm font-body text-[12px] text-ink/45 hover:text-ink/70 hover:bg-ink/[0.04]"
                      >
                        <Plus size={12} />
                        New tag
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
