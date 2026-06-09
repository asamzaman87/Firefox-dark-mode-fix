import { pdfjs } from "react-pdf";

// Same-origin worker URL inside the extension. In the Firefox background page
// this is same-origin with the document, so pdf.js spawns a real module worker
// (no blob wrapper, no host-page CSP). In the Chrome content script the worker
// is created from a chrome-extension URL, which Chrome allows.
pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.js");

type PdfTextItem = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
  hasEOL?: boolean;
};

// Build page text from pdf.js text items.
//
// Joining items with a space is wrong for the many PDFs that split words into
// glyph/sub-word fragments ("S","u","b","mit") — that produces "S u b mit".
// Instead we reconstruct spacing from geometry: items already carry their own
// explicit space items and x/y positions, so we only insert a space when there
// is a real horizontal gap or a line break between two fragments.
function itemsToPageText(items: PdfTextItem[]): string {
  let text = "";
  let prev: PdfTextItem | null = null;
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    // Empty items mark line ends; turn those into a single separating space.
    if (item.str.length === 0) {
      if (item.hasEOL && text && !/\s$/.test(text)) text += " ";
      continue;
    }
    if (prev) {
      const prevX = prev.transform?.[4] ?? 0;
      const prevW = prev.width ?? 0;
      const curX = item.transform?.[4] ?? 0;
      const fontH = item.height || prev.height || 10;
      const gap = curX - (prevX + prevW);
      const prevY = prev.transform?.[5] ?? 0;
      const curY = item.transform?.[5] ?? 0;
      const newLine =
        !!prev.hasEOL || Math.abs(curY - prevY) > Math.max(fontH * 0.5, 1);
      const needSpace = newLine || gap > Math.max(fontH * 0.25, 1);
      if (needSpace && !/\s$/.test(text) && !/^\s/.test(item.str)) text += " ";
    }
    text += item.str;
    prev = item;
  }
  return text.replace(/[ \t]{2,}/g, " ").trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Build structured HTML for a page from pdf.js text items.
//
// The plain-text version above intentionally collapses line breaks into spaces
// (so phrase search works across wraps). For the fallback document view we want
// readable paragraphs. The key subtlety: a visual line wrap inside a PDF is NOT
// a semantic line break — wrapped lines belong to the same paragraph and should
// flow together. So we first reconstruct individual lines from geometry, then
// merge consecutive lines into paragraphs, only starting a NEW paragraph when
// the vertical gap before a line is clearly larger than the page's normal line
// spacing (≈ a blank line). The threshold adapts to each document's leading
// (median line gap) so we don't break too early on tightly-spaced body text.
function itemsToPageHtml(items: PdfTextItem[]): string {
  type Line = { text: string; gapBefore: number };
  const lines: Line[] = [];
  let curLine = "";
  let gapBefore = 0;
  let prev: PdfTextItem | null = null;
  let pendingEOL = false;

  const pushLine = (nextGap: number) => {
    const t = curLine.replace(/[ \t]{2,}/g, " ").trim();
    if (t) lines.push({ text: t, gapBefore });
    curLine = "";
    gapBefore = nextGap;
  };

  for (const item of items) {
    if (typeof item.str !== "string") continue;
    if (item.str.length === 0) {
      if (item.hasEOL) pendingEOL = true;
      continue;
    }
    if (prev) {
      const prevX = prev.transform?.[4] ?? 0;
      const prevW = prev.width ?? 0;
      const curX = item.transform?.[4] ?? 0;
      const fontH = item.height || prev.height || 10;
      const gap = curX - (prevX + prevW);
      const prevY = prev.transform?.[5] ?? 0;
      const curY = item.transform?.[5] ?? 0;
      const dy = Math.abs(curY - prevY);
      const newLine = pendingEOL || !!prev.hasEOL || dy > Math.max(fontH * 0.5, 1);
      if (newLine) {
        pushLine(dy);
      } else {
        const needSpace = gap > Math.max(fontH * 0.25, 1);
        if (needSpace && !/\s$/.test(curLine) && !/^\s/.test(item.str)) curLine += " ";
      }
    }
    curLine += item.str;
    prev = item;
    pendingEOL = false;
  }
  pushLine(0);

  if (!lines.length) return "";

  // Typical line spacing for this page (median of positive gaps). A paragraph
  // boundary is a gap noticeably larger than that.
  const positiveGaps = lines
    .map((l) => l.gapBefore)
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  const median = positiveGaps.length
    ? positiveGaps[Math.floor(positiveGaps.length / 2)]
    : 0;
  const paraThreshold = median > 0 ? median * 1.5 : Infinity;

  const paragraphs: string[] = [];
  let cur = "";
  lines.forEach((line, idx) => {
    if (idx === 0) {
      cur = line.text;
      return;
    }
    if (line.gapBefore > paraThreshold) {
      if (cur.trim()) paragraphs.push(cur.trim());
      cur = line.text;
    } else {
      cur += (cur && !/\s$/.test(cur) ? " " : "") + line.text;
    }
  });
  if (cur.trim()) paragraphs.push(cur.trim());

  if (!paragraphs.length) return "";
  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

// Coerce whatever crossed the messaging boundary into a real Uint8Array.
function toUint8Array(input: ArrayBuffer | Uint8Array | number[] | unknown): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return Uint8Array.from(input as number[]);
  if (input && typeof input === "object" && "byteLength" in (input as ArrayBufferView)) {
    const view = input as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  // Last resort: array-like object with numeric keys (e.g. JSON-serialized).
  if (input && typeof input === "object") {
    return Uint8Array.from(Object.values(input as Record<string, number>));
  }
  throw new Error("There was an error parsing the file! It might not have valid text content.");
}

// Extract per-page plain text from raw PDF bytes.
//
// We feed pdf.js the bytes directly via `data` instead of a blob: URL. Loading
// by URL makes pdf.js fetch the blob, which on strict host pages trips the
// `connect-src` CSP and a "Failed to construct 'Headers'" error in the network
// layer. Passing the bytes avoids that path entirely.
export type PdfExtraction = {
  /** Per-page plain text (line breaks collapsed to spaces). */
  pages: string[];
  /** Per-page structured HTML (paragraphs/line breaks preserved). */
  pagesHtml: string[];
};

export async function extractPdfPages(
  input: ArrayBuffer | Uint8Array | number[]
): Promise<PdfExtraction> {
  const bytes = toUint8Array(input);
  if (!bytes.byteLength) {
    throw new Error("There was an error parsing the file! It might not have valid text content.");
  }
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pages: string[] = [];
  const pagesHtml: string[] = [];
  try {
    const pdf = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const items = textContent.items as PdfTextItem[];
      pages.push(itemsToPageText(items));
      pagesHtml.push(itemsToPageHtml(items));
    }
  } finally {
    try {
      loadingTask.destroy();
    } catch {
      /* noop */
    }
  }
  return { pages, pagesHtml };
}
