/**
 * useKeyboardShortcuts.js
 * ------------------------
 * Wires up global keyboard shortcuts for studying a deck hands-free:
 *
 *   Space / Enter   -> flip the current card (reveal/hide meaning)
 *   ArrowRight      -> next card
 *   ArrowLeft       -> previous card
 *
 * Guards against firing while the user is typing in any text input,
 * textarea, select, or contenteditable element (e.g. the import
 * textarea, a category rename field, the regex pattern input) so
 * pressing Space to type a space character doesn't also flip the card
 * underneath whatever panel is open.
 *
 * Only active when `enabled` is true — the caller passes false while a
 * settings/import panel is open over the deck view, as an extra safety
 * net on top of the input-element check.
 */

import { useEffect } from "react";

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTypingTarget(target) {
  if (!target) return false;
  if (TYPING_TAGS.has(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts({ onFlip, onNext, onPrevious, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;

      switch (event.key) {
        case " ":
        case "Spacebar":
        case "Enter":
          event.preventDefault();
          onFlip();
          break;
        case "ArrowRight":
          event.preventDefault();
          onNext();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onPrevious();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onFlip, onNext, onPrevious, enabled]);
}
