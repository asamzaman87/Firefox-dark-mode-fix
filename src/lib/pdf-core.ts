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
export async function extractPdfPages(
  input: ArrayBuffer | Uint8Array | number[]
): Promise<string[]> {
  const bytes = toUint8Array(input);
  if (!bytes.byteLength) {
    throw new Error("There was an error parsing the file! It might not have valid text content.");
  }
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pages: string[] = [];
  try {
    const pdf = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pages.push(itemsToPageText(textContent.items as PdfTextItem[]));
    }
  } finally {
    try {
      loadingTask.destroy();
    } catch {
      /* noop */
    }
  }
  return pages;
}
