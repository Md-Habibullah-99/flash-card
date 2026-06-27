/**
 * fileImport.js
 * --------------
 * Reads an uploaded file into either raw text (for .txt parsing through
 * a format profile) or directly into a finished card array (for .json
 * files that already match — or can be coerced into — our card shape).
 *
 * Supported inputs:
 *  - .txt              -> raw text, handed to parseWithProfile()
 *  - .pdf               -> text extracted client-side via pdfjs-dist,
 *                          then handed to parseWithProfile() same as .txt
 *  - .json              -> parsed directly into cards (see normalizeJsonCards)
 *
 * Everything here runs in the browser; no file ever leaves the device.
 *
 * pdfjs-dist is loaded with a dynamic import inside extractPdfText()
 * rather than at the top of this file — it's a large library, and most
 * sessions never touch a PDF, so there's no reason to ship it in the
 * main bundle for everyone.
 */

/** Reads a .txt File object as plain text. */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

/**
 * Extracts all text from a PDF File object, page by page, joined with
 * blank lines between pages (so a category header that starts a new
 * page doesn't accidentally fuse onto the previous page's last line).
 */
export async function extractPdfText(file) {
  const [pdfjsLib, pdfWorkerUrlModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrlModule.default;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // pdf.js gives us individual text items with positions, not lines.
    // We reconstruct line breaks by watching for a drop in Y position
    // between consecutive items (a new line in the original layout).
    let lineText = "";
    let lastY = null;
    const lines = [];

    for (const item of content.items) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 1) {
        lines.push(lineText.trim());
        lineText = "";
      }
      lineText += item.str + (item.hasEOL ? "" : " ");
      lastY = y;
    }
    if (lineText.trim()) lines.push(lineText.trim());

    pageTexts.push(lines.join("\n"));
  }

  return pageTexts.join("\n\n");
}

/**
 * Normalizes a parsed JSON value into our card shape. Accepts either:
 *  - an array already shaped like our cards (id/category/word/meaning/...),
 *  - or a looser array of objects using common alternate key names
 *    (e.g. "term"/"translation"), which get mapped onto our fields.
 * Missing optional fields default sensibly; missing required fields
 * (word) cause that entry to be skipped rather than the whole import
 * failing.
 */
export function normalizeJsonCards(parsedJson) {
  const list = Array.isArray(parsedJson)
    ? parsedJson
    : Array.isArray(parsedJson?.cards)
    ? parsedJson.cards
    : null;

  if (!list) {
    throw new Error("This JSON file doesn't contain a recognizable card list.");
  }

  let counter = 0;
  const cards = [];

  for (const raw of list) {
    const word = raw.word ?? raw.term ?? raw.front ?? null;
    if (!word) continue; // skip entries with no usable word field

    counter += 1;
    cards.push({
      id: raw.id || `card-${String(counter).padStart(4, "0")}`,
      category: raw.category || raw.group || "Uncategorized",
      word: String(word).trim(),
      meaning: String(raw.meaning ?? raw.translation ?? raw.back ?? "").trim(),
      example: String(raw.example ?? raw.sentence ?? "").trim(),
      exampleMeaning: String(raw.exampleMeaning ?? raw.sentenceTranslation ?? "").trim(),
      statuses: Array.isArray(raw.statuses)
        ? raw.statuses
        : raw.status && raw.status !== "unmarked"
        ? [raw.status]
        : [],
    });
  }

  if (cards.length === 0) {
    throw new Error("No usable cards were found in this JSON file.");
  }

  return cards;
}

/**
 * Reads a .json File object and returns a normalized card array.
 */
export async function readJsonFile(file) {
  const text = await readTextFile(file);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error("This file isn't valid JSON.");
  }
  return normalizeJsonCards(parsed);
}

/** Returns the lowercased extension of a File's name, without the dot. */
export function getFileExtension(file) {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}
