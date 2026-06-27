/**
 * categoryTree.js
 * ----------------
 * Derives the full navigation structure (categories -> tag sub-views)
 * from the flat `cards` array plus the user-editable `tags` list. We
 * deliberately do NOT store a separate nested tree in state: cards are
 * the single source of truth for "which tags does this card have", and
 * every filtered view (a category's "Difficult" list, "All Words"'s
 * "Favorite" list, etc.) is recomputed from that array. This guarantees
 * a tag change on one card can never get out of sync between
 * "Main Category -> Difficult" and "All Words -> Difficult".
 *
 * TAGS (formerly a single fixed "status")
 * -----------------------------------------
 * A card can now hold MULTIPLE tags at once — e.g. "easy" + "done", or
 * "favorite" + "done". The four built-in tags are
 * difficult / easy / favorite / done; users can also create their own
 * custom tags (e.g. "needs-review"). The only hard rule: "difficult"
 * and "easy" are mutually exclusive on the same card — adding one
 * removes the other. Every other combination is freely allowed.
 *
 * Cards store this as `statuses: string[]`.
 *
 * CATEGORIES
 * ----------
 * Main categories are derived from `card.category` strings. Two
 * categories can be merged into one (mergeCategories), which is just a
 * string rewrite on every affected card — there's no separate category
 * table to keep in sync. "All Words" is a fixed pseudo-category that
 * always means "every card" and can't be merged, renamed, or removed.
 */

export const ALL_WORDS_CATEGORY = "All Words";

// The four tags every deck starts with. Exposed as data (not just an
// id list) because custom tags get added alongside them at runtime,
// and a tag needs a human label plus a "can this be deleted" flag.
export const BUILT_IN_TAGS = [
  { id: "difficult", label: "Difficult", builtIn: true },
  { id: "easy", label: "Easy", builtIn: true },
  { id: "favorite", label: "Favorite", builtIn: true },
  { id: "done", label: "Done", builtIn: true },
];

// Tag id pairs that exclude each other — adding one strips the other
// from the same card. Expressed as pairs so more exclusivity rules
// could be added later without touching the marking logic itself.
export const EXCLUSIVE_TAG_PAIRS = [["difficult", "easy"]];

export function getExclusiveTagsFor(tagId) {
  const partners = [];
  for (const [a, b] of EXCLUSIVE_TAG_PAIRS) {
    if (a === tagId) partners.push(b);
    if (b === tagId) partners.push(a);
  }
  return partners;
}

export function tagLabel(tagId, tags) {
  if (tagId === "all") return "All";
  const tag = (tags || BUILT_IN_TAGS).find((t) => t.id === tagId);
  return tag ? tag.label : tagId;
}

/**
 * Returns an ordered list of category names as they first appear in the
 * card array, with "All Words" pinned to the front. Using first-seen
 * order (rather than alphabetical) keeps categories in the same order
 * they appeared in the source document, which matches how a learner
 * paced through their material.
 */
export function getCategoryList(cards) {
  const seen = [];
  for (const card of cards) {
    if (!seen.includes(card.category)) {
      seen.push(card.category);
    }
  }
  return [ALL_WORDS_CATEGORY, ...seen];
}

/**
 * Returns the cards belonging to a given category. "All Words" returns
 * every card regardless of category.
 */
export function getCardsForCategory(cards, category) {
  if (category === ALL_WORDS_CATEGORY) return cards;
  return cards.filter((c) => c.category === category);
}

/**
 * Applies a tag sub-category filter on top of a category's cards.
 * 'all' returns the category's full list unfiltered. Any other value
 * is treated as a tag id and matches cards whose `statuses` array
 * includes it.
 */
export function filterByTag(cards, tagId) {
  if (tagId === "all") return cards;
  return cards.filter((c) => Array.isArray(c.statuses) && c.statuses.includes(tagId));
}

/**
 * Convenience combined selector: given the full card list, a selected
 * category, and a selected tag filter, returns the exact deck the
 * flashcard viewer should show.
 */
export function getActiveDeck(cards, category, tagId) {
  const categoryCards = getCardsForCategory(cards, category);
  return filterByTag(categoryCards, tagId);
}

/**
 * Counts cards per tag within a category — used to show badge counts
 * in the sidebar (e.g. "Difficult (4)") so learners can see progress
 * without opening each sub-category. `tags` should be the full active
 * tag list (built-ins + custom) so counts include user-created tags too.
 */
export function getTagCounts(cards, category, tags) {
  const categoryCards = getCardsForCategory(cards, category);
  const counts = { all: categoryCards.length };
  for (const tag of tags) {
    counts[tag.id] = categoryCards.filter(
      (c) => Array.isArray(c.statuses) && c.statuses.includes(tag.id)
    ).length;
  }
  return counts;
}

/**
 * Toggles a tag on a single card, honoring mutual-exclusion rules.
 * Returns a NEW statuses array (does not mutate the input).
 *
 *  - If the card already has the tag, it's removed (toggle off).
 *  - If the card doesn't have it, it's added, and any tags that are
 *    mutually exclusive with it (see EXCLUSIVE_TAG_PAIRS) are removed
 *    first — so adding "easy" to a card tagged "difficult" silently
 *    drops "difficult", and vice versa.
 */
export function toggleCardTag(currentStatuses, tagId) {
  const current = Array.isArray(currentStatuses) ? currentStatuses : [];
  if (current.includes(tagId)) {
    return current.filter((t) => t !== tagId);
  }
  const exclusive = getExclusiveTagsFor(tagId);
  const withoutExclusive = current.filter((t) => !exclusive.includes(t));
  return [...withoutExclusive, tagId];
}

/**
 * Renames a category across every card, OR merges one category into
 * another if the target name already exists among other cards. Either
 * way this is just a string rewrite on `card.category` — there is no
 * separate category table to keep in sync.
 *
 * @param {Array} cards
 * @param {string} fromCategory - category being renamed/merged away
 * @param {string} toCategory - new name (merge target if it already exists)
 */
export function mergeCategories(cards, fromCategory, toCategory) {
  const trimmedTarget = toCategory.trim();
  if (!trimmedTarget || fromCategory === ALL_WORDS_CATEGORY) return cards;
  return cards.map((c) =>
    c.category === fromCategory ? { ...c, category: trimmedTarget } : c
  );
}
