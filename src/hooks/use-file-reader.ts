import mammoth from "mammoth";
import { pdfjs } from "react-pdf";

// Path to the pdf.worker.js file
pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.js");

// ── Types ────────────────────────────────────────────────────────────
export type SectionIndex = {
  id: string;
  label: string;
  start: number;
  end: number;
  preview?: string;
};

export type StructuredText = {
  /** Plain text for TTS/chunking & offsets */
  fullText: string;
  /** Optional HTML for rich preview (DOCX/TXT) */
  fullHtml?: string;
  sections: SectionIndex[];
  source: "pdf" | "docx" | "text";
};

// ── Helpers ──────────────────────────────────────────────────────────
const clampPreview = (s: string, n = 160) =>
  s.replace(/\s+/g, " ").trim().slice(0, n);

const DEFAULT_PAGE_CHARS = 1800;

function findWordSafeBreak(text: string, start: number, approx: number, window = 280) {
  const soft = Math.min(text.length, start + approx);
  for (let i = soft; i >= Math.max(start + 1, soft - window); i--) {
    const ch = text[i];
    if (/\s/.test(ch)) return i;
  }
  for (let i = soft + 1; i <= Math.min(text.length - 1, soft + window); i++) {
    const ch = text[i];
    if (/\s/.test(ch)) return i;
  }
  return Math.min(text.length, start + approx);
}

const chunkByLength = (
  text: string,
  approx = DEFAULT_PAGE_CHARS,
  labelPrefix = "Page "
): SectionIndex[] => {
  const sections: SectionIndex[] = [];
  let i = 0;
  let start = 0;

  while (start < text.length) {
    const end = findWordSafeBreak(text, start, approx);
    const slice = text.slice(start, end);
    sections.push({
      id: `page_${i + 1}`,
      label: `${labelPrefix}${i + 1}`,
      start,
      end,
      preview: clampPreview(slice),
    });
    start = end;
    i++;
  }

  if (sections.length === 0) {
    sections.push({
      id: "page_1",
      label: `${labelPrefix}1`,
      start: 0,
      end: text.length,
      preview: clampPreview(text),
    });
  }
  return sections;
};

export function makeHtmlProgressSlicer(
  html: string,
  opts?: { caseInsensitive?: boolean }
) {
  const caseInsensitive = opts?.caseInsensitive !== false;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html || "", "text/html");
  const root = doc.body;

  // Collect text nodes (DOM order)
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  // Helper: map an alnum-count to a DOM endpoint (node, offset)
  type DomPoint = { node: Text; offset: number };
  const alphaToDom: DomPoint[] = []; // 1-based index: alphaToDom[k] = end of k-th alnum
  const alphaChars: string[] = [];   // normalized alnum chars from the DOM (for compare)

  // Matches any Unicode letter or number
  const isAlnum = (ch: string) => /\p{L}|\p{N}/u.test(ch);

  for (const node of textNodes) {
    const data = node.data || "";
    for (let i = 0; i < data.length; i++) {
      const ch = data[i];
      if (!isAlnum(ch)) continue;

      const norm = caseInsensitive ? ch.toLowerCase() : ch;
      alphaChars.push(norm);

      // record the DOM position right AFTER this alnum
      alphaToDom.push({ node, offset: i + 1 });
    }
  }

  // Joined alnum stream + a memoized base to support mid-document starts
  const alphaJoined = alphaChars.join("");
  let baseAlphaIndex = -1; // will be set on first successful alignment

  // Build a Range for a given "alnum count" (how many alnums to keep)
  function rangeBetweenAlphaCounts(startK: number, endK: number): Range {
    const r = doc.createRange();

    // start
    if (startK <= 0 || alphaToDom.length === 0) {
        r.setStart(root, 0);
    } else {
        const { node, offset } = alphaToDom[Math.min(startK, alphaToDom.length) - 1];
        r.setStart(node, offset);
    }

    // end
    if (endK <= 0 || alphaToDom.length === 0) {
        r.setEnd(root, 0);
    } else {
        const { node, offset } = alphaToDom[Math.min(endK, alphaToDom.length) - 1];
        r.setEnd(node, offset);
    }

    return r;
  }

  function htmlForRange(r: Range) {
    const frag = r.cloneContents();
    const tmp = doc.createElement("div");
    tmp.appendChild(frag);
    return tmp.innerHTML;
  }

   // Public API: slice by *reference text* (match alnums only, from an aligned base)
  return function sliceByRef(refText: string): string {
    if (!refText) return "";

    // normalize reference to alnums
    let ref = "";
    for (let i = 0; i < refText.length; i++) {
      const ch = refText[i];
      if (isAlnum(ch)) ref += caseInsensitive ? ch.toLowerCase() : ch;
    }
    if (!ref) return "";

    // If we haven't aligned yet (e.g., user started from page N), find a base.
    if (baseAlphaIndex < 0) {
      // Try progressively longer/shorter seeds so early ticks can still align.
      const targets = [128, 96, 64, 48, 32, 24, 16, 12, 8, 6, 4].map(n => Math.min(n, ref.length));
      let found = -1;
      for (const seedLen of targets) {
        const seed = ref.slice(0, seedLen);
        if (!seed) continue;
        const idx = alphaJoined.indexOf(seed);
        if (idx >= 0) { found = idx; break; }
      }
      // If still not found, give up for now; next tick (with more ref) will try again.
      if (found < 0) return "";
      baseAlphaIndex = found;
    }

    // Compare from the aligned base
    let matched = 0;
    const need = ref.length;
    const max = Math.min(need, Math.max(0, alphaJoined.length - baseAlphaIndex));
    while (matched < max) {
      if (alphaJoined[baseAlphaIndex + matched] !== ref[matched]) break;
      matched++;
    }

    // Emit HTML up to base+matched (monotonic growth)
    const r = rangeBetweenAlphaCounts(baseAlphaIndex, baseAlphaIndex + matched);
    return htmlForRange(r);
  };
}


// ── Existing functions (kept) ────────────────────────────────────────
const pdfToText = async (file: File | Blob | MediaSource): Promise<string> => {
  const blobUrl = URL.createObjectURL(file);
  const loadingTask = pdfjs.getDocument(blobUrl);

  let extractedText = "";
  let hadParsingError = false;
  try {
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      extractedText += pageText;
    }
  } catch {
    hadParsingError = true;
  }

  URL.revokeObjectURL(blobUrl);
  loadingTask.destroy();

  if (!hadParsingError) {
    if (extractedText.trim().length === 0) {
      throw new Error("There was an error parsing the file! It might not have valid text content.");
    }
    return extractedText;
  }
  throw new Error("There was an error parsing the file! It might not have valid text content.");
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getParagraphs(content: any) {
  const result = await mammoth.convertToHtml({ arrayBuffer: content });
  return result.value;
}

const docxToText = async <T = string>(file: File): Promise<T | string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const content = e.target?.result as ArrayBuffer;
      const text = await getParagraphs(content);
      if (text.trim().length > 0) return resolve(text as T);
      reject(new Error("There was an error parsing the file! It might not have valid text content."));
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });

const textPlainToText = async (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      if (file.type === "text/plain" || file.type === "text/rtf") {
        const text = e.target?.result as string;
        if (text.trim().length > 0) return resolve(text);
        reject(new Error("There was an error parsing the file! It might not have valid text content."));
        return;
      }
      reject(new Error("File is not text/plain"));
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });

const pdfToStructured = async (file: File): Promise<StructuredText> => {
  const blobUrl = URL.createObjectURL(file);
  const loadingTask = pdfjs.getDocument(blobUrl);

  const pages: string[] = [];
  try {
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();
      pages.push(pageText);
    }
  } finally {
    URL.revokeObjectURL(blobUrl);
    loadingTask.destroy();
  }

  const fullText = pages.join("");
  if (!fullText.trim()) {
    throw new Error("There was an error parsing the file! It might not have valid text content.");
  }

  const sections: SectionIndex[] = [];
  let offset = 0;
  pages.forEach((p, i) => {
    sections.push({
      id: `page_${i + 1}`,
      label: `Page ${i + 1}`,
      start: offset,
      end: offset + p.length,
      preview: clampPreview(p),
    });
    offset += p.length;
  });

  return { fullText, sections, source: "pdf" };
};

const docxToStructured = async (file: File): Promise<StructuredText> => {
  const html = (await docxToText<string>(file)) as string;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const plain = doc.body.textContent || "";
  return {
    fullText: plain,
    fullHtml: html,
    sections: chunkByLength(plain, DEFAULT_PAGE_CHARS, "Page "),
    source: "docx",
  };
};

const textToStructured = (raw: string): StructuredText => {
  const plain = raw.replace(/\r/g, "");
  const html = plain.replace(/\n/g, "<br/>");
  return {
    fullText: plain,
    fullHtml: html,
    sections: chunkByLength(plain, DEFAULT_PAGE_CHARS, "Page "),
    source: "text",
  };
};

export default function useFileReader() {
  return {
    pdfToText,
    docxToText,
    textPlainToText,
    pdfToStructured,
    docxToStructured,
    textToStructured,
    makeHtmlProgressSlicer,
  };
}
