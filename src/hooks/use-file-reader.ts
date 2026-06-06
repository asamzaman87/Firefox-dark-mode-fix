import mammoth from "mammoth";
import { unzipSync, strFromU8 } from "fflate";
import { extractPdfPages } from "@/lib/pdf-core";

const isFirefox =
  typeof navigator !== "undefined" && /Firefox/.test(navigator.userAgent);

// Robustly read a File/Blob into an ArrayBuffer.
//
// Some OS/file combinations throw `NotReadableError` from `file.arrayBuffer()`
// ("The requested file could not be read…") when the underlying file handle has
// gone stale after the drop. We retry once and fall back to FileReader, which
// can succeed where `arrayBuffer()` fails.
const readArrayBuffer = async (file: File | Blob): Promise<ArrayBuffer> => {
  const viaFileReader = (blob: Blob) =>
    new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer && result.byteLength > 0) {
          resolve(result);
        } else {
          reject(new Error("The file could not be read. Please try re-selecting it."));
        }
      };
      reader.onerror = () =>
        reject(reader.error || new Error("The file could not be read. Please try re-selecting it."));
      reader.readAsArrayBuffer(blob);
    });

  // Try several strategies: arrayBuffer(), a fresh slice (re-acquires the OS
  // handle, which often clears NotReadableError), and FileReader on both. Some
  // files throw "could not be read" on one path but succeed on another.
  const sliced = typeof file.slice === "function" ? file.slice(0, file.size) : file;
  const attempts: Array<() => Promise<ArrayBuffer>> = [
    () => file.arrayBuffer(),
    () => sliced.arrayBuffer(),
    () => viaFileReader(file),
    () => viaFileReader(sliced),
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      const buffer = await attempts[i]();
      if (buffer && buffer.byteLength > 0) return buffer;
    } catch {
      // try the next strategy
    }
    await new Promise((res) => setTimeout(res, 100));
  }

  throw new Error(
    "The file could not be read. It may have moved or its permissions changed — please re-select it."
  );
};

// Get per-page PDF text. On Chrome we parse in-place (the pdf.js worker is
// allowed from a chrome-extension URL). On Firefox the host page CSP blocks
// both the worker and the blob fetch in the content script, so we hand the raw
// bytes to the background page (same-origin worker, no page CSP) to parse.
const getPdfPages = async (file: File | Blob): Promise<string[]> => {
  const buffer = await readArrayBuffer(file);
  if (!buffer || buffer.byteLength === 0) {
    throw new Error("There was an error parsing the file! It might not have valid text content.");
  }

  if (isFirefox) {
    const bytes = new Uint8Array(buffer);
    const res = await chrome.runtime.sendMessage({
      type: "PARSE_PDF",
      payload: { bytes },
    });
    if (!res || res.error || !Array.isArray(res.pages)) {
      throw new Error(
        res?.error ||
          "There was an error parsing the file! It might not have valid text content."
      );
    }
    return res.pages as string[];
  }

  return extractPdfPages(buffer);
};

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

// ── EPUB helpers (NEW) ─────────────────────────────────────────────────────────

/** Very small sanitizer: removes risky tags + attributes, keeps readable markup */
function sanitizeHtmlFragment(fragmentHtml: string): HTMLElement {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fragmentHtml, "text/html");
  const root = doc.body;

  // 1) Drop dangerous/irrelevant elements
  root.querySelectorAll(
    "script,style,link,iframe,frame,frameset,object,embed,form,video,audio,source"
  ).forEach(n => n.remove());

  // 2) Strip risky attributes
  root.querySelectorAll("*").forEach(el => {
    const attrNames = Array.from(el.attributes).map(a => a.name);
    for (const name of attrNames) {
      if (
        name.startsWith("on") ||
        name === "style" ||
        name === "target"
      ) {
        el.removeAttribute(name);
      }
      // neuter anchors
      if (el.tagName.toLowerCase() === "a" && name === "href") {
        el.setAttribute("href", "#");
      }
    }
  });

  return root;
}

/** Path resolve helper for zip paths (base can be like `OPS/book.opf`) */
function resolveZipHref(basePath: string, href: string): string {
  try {
    const baseDir = basePath.replace(/[^\/]+$/, "");
    // use URL with dummy origin for robust resolution
    const url = new URL(href, `https://x/${baseDir}`);
    // strip origin
    return decodeURIComponent(url.pathname.slice(1));
  } catch {
    // fallback: naive join
    const baseDir = basePath.replace(/[^\/]+$/, "");
    return (baseDir + href).replace(/\/\.\//g, "/");
  }
}

/** crude mime from extension (for images mostly) */
function mimeFromExt(p: string): string {
  const ext = p.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

// Keep track of blob URLs created for a specific StructuredText so we can revoke later
const _blobRegistry = new WeakMap<object, string[]>();

/** Detect likely DRM: presence of META-INF/encryption.xml referencing non-font content */
function isLikelyDrm(zip: Record<string, Uint8Array>): boolean {
  const encKey = Object.keys(zip).find(
    k => k.toLowerCase() === "meta-inf/encryption.xml"
  );
  if (!encKey) return false;
  try {
    const xml = strFromU8(zip[encKey]);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    // If it references encrypted data and doesn't look like just font obfuscation, treat as DRM
    const encNodes = Array.from(doc.getElementsByTagName("EncryptedData"));
    if (!encNodes.length) return false;
    const algos = encNodes
      .map(n => n.querySelector("EncryptionMethod")?.getAttribute("Algorithm") || "")
      .join(" ");
    // IDPF font obfuscation URIs are the "safe" case. Anything else → likely DRM.
    const onlyFont =
      /idpf\.org\/2008\/embedding/i.test(algos) && !/xmlenc/i.test(algos);
    return !onlyFont;
  } catch {
    return true; // be conservative on parse failure
  }
}

/** Parse EPUB to StructuredText (treated as "docx" source to reuse needle path) */
const epubToStructured = async (file: File): Promise<StructuredText> => {
  let bytes: Uint8Array;
  let zip: Record<string, Uint8Array>;
  
  try {
    const arrayBuffer = await readArrayBuffer(file);
    bytes = new Uint8Array(arrayBuffer);
    // Wrap unzipSync in try-catch to handle Firefox CSP issues with constructor access
    try {
      zip = unzipSync(bytes); // filename (case-sensitive) -> Uint8Array
    } catch (unzipError: any) {
      console.error("[epubToStructured] Error unzipping EPUB:", unzipError);
      // If unzipSync fails due to CSP/constructor issues, try with a fresh Uint8Array copy
      const bytesCopy = new Uint8Array(bytes.length);
      bytesCopy.set(bytes);
      zip = unzipSync(bytesCopy);
    }
  } catch (error: any) {
    console.error("[epubToStructured] Error reading EPUB file:", error);
    throw new Error(error?.message || "There was an error reading the EPUB file. Please ensure it's a valid EPUB file.");
  }

  // Normalize key lookup (case-insensitive) via a resolver
  const keyList = Object.keys(zip);
  const findKey = (p: string) => {
    const norm = p.replace(/\\/g, "/");
    const exact = keyList.find(k => k === norm);
    if (exact) return exact;
    const lower = norm.toLowerCase();
    return keyList.find(k => k.toLowerCase() === lower) || null;
  };

  // container.xml → OPF path
  const containerKey =
    findKey("META-INF/container.xml") || findKey("meta-inf/container.xml");
  if (!containerKey) {
    throw new Error("Invalid EPUB: missing META-INF/container.xml");
  }
  const containerXml = strFromU8(zip[containerKey]);
  const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
  const rootfileEl = containerDoc.querySelector("rootfile");
  const opfPath = rootfileEl?.getAttribute("full-path") || "";
  if (!opfPath) throw new Error("Invalid EPUB: missing OPF path");

  const opfKey = findKey(opfPath);
  if (!opfKey) throw new Error("Invalid EPUB: OPF not found in archive");
  const opfXml = strFromU8(zip[opfKey]);
  const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

  // DRM check early
  if (isLikelyDrm(zip)) {
    throw new Error("This EPUB appears to be DRM-protected and can’t be read.");
  }

  // manifest map: id -> href/media-type/properties
  const manifest = new Map<
    string,
    { href: string; type: string; properties: string | null }
  >();
  opfDoc.querySelectorAll("manifest > item").forEach((it) => {
    manifest.set(it.getAttribute("id") || "", {
      href: it.getAttribute("href") || "",
      type: it.getAttribute("media-type") || "",
      properties: it.getAttribute("properties"),
    });
  });

  // spine reading order (ids)
  const spineIds: string[] = [];
  opfDoc.querySelectorAll("spine > itemref").forEach((ir) => {
    const idref = ir.getAttribute("idref");
    if (idref) spineIds.push(idref);
  });
  if (!spineIds.length) throw new Error("Invalid EPUB: empty reading spine");

  // TOC labels (EPUB3 nav.xhtml or EPUB2 toc.ncx)
  const labelsByHref = new Map<string, string>();
  // EPUB 3: nav
  const navItemId = Array.from(manifest.entries()).find(
    ([, v]) => (v.properties || "").split(/\s+/).includes("nav")
  )?.[0];
  if (navItemId) {
    const href = manifest.get(navItemId)!.href;
    const navKey = findKey(resolveZipHref(opfPath, href));
    if (navKey) {
      const navHtml = strFromU8(zip[navKey]);
      const navDoc = new DOMParser().parseFromString(navHtml, "text/html");
      const tocNav =
        navDoc.querySelector('nav[epub\\:type="toc"]') ||
        navDoc.querySelector('nav[role="doc-toc"]') ||
        navDoc.querySelector("nav");
      if (tocNav) {
        tocNav.querySelectorAll("a[href]").forEach((a) => {
          const raw = a.getAttribute("href") || "";
          const label = a.textContent?.trim() || "";
          if (!raw || !label) return;
          const pathOnly = raw.split("#")[0];
          const abs = resolveZipHref(opfPath, pathOnly);
          labelsByHref.set(abs.toLowerCase(), label);
        });
      }
    }
  } else {
    // EPUB 2: NCX
    const ncxId = Array.from(manifest.entries()).find(
      ([, v]) => v.type === "application/x-dtbncx+xml"
    )?.[0];
    if (ncxId) {
      const href = manifest.get(ncxId)!.href;
      const ncxKey = findKey(resolveZipHref(opfPath, href));
      if (ncxKey) {
        const ncxXml = strFromU8(zip[ncxKey]);
        const ncxDoc = new DOMParser().parseFromString(ncxXml, "application/xml");
        ncxDoc.querySelectorAll("navPoint").forEach((np) => {
          const label = np.querySelector("navLabel > text")?.textContent?.trim() || "";
          const src = np.querySelector("content")?.getAttribute("src") || "";
          if (!src || !label) return;
          const pathOnly = src.split("#")[0];
          const abs = resolveZipHref(opfPath, pathOnly);
          labelsByHref.set(abs.toLowerCase(), label);
        });
      }
    }
  }

  // Build HTML + text + sections
  const blobUrls: string[] = [];
  const fullHtmlParts: string[] = [];
  const sections: SectionIndex[] = [];

  let fullText = "";
  let offset = 0;

  const parser = new DOMParser();

  for (let i = 0; i < spineIds.length; i++) {
    const id = spineIds[i];
    const it = manifest.get(id);
    if (!it) continue;
    const href = it.href;
    const absPath = resolveZipHref(opfPath, href);
    const itemKey = findKey(absPath);
    if (!itemKey) continue;

    const media = it.type;
    if (!/xhtml|html/i.test(media)) {
      // skip non-XHTML spine items
      continue;
    }

    const xhtml = strFromU8(zip[itemKey]);
    // sanitize + resolve images
    const fragRoot = sanitizeHtmlFragment(xhtml);

    // rewrite image src to blob URLs from zip
    const imgs = fragRoot.querySelectorAll("img");
    imgs.forEach((img) => {
      // prefer src, else fallback to srcset first candidate, else data-src/lazy attrs
      let raw = img.getAttribute("src") || "";

      if (!raw) {
        const ss = img.getAttribute("srcset");
        if (ss) {
          // take the first candidate URL (before space/comma)
          const first = ss.split(",")[0]?.trim();
          if (first) raw = first.split(/\s+/)[0];
        }
      }

      // common lazy attributes
      if (!raw) raw = img.getAttribute("data-src") || "";
      if (!raw) raw = img.getAttribute("data-original") || "";
      if (!raw) raw = img.getAttribute("data-lazy-src") || "";

      if (!raw) return;

      // skip data URIs or external links
      if (/^data:/i.test(raw) || /^https?:/i.test(raw)) return;

      // drop fragment/query (e.g., foo.svg#id?x=1)
      const clean = raw.split("#")[0].split("?")[0];
      const resolved = resolveZipHref(absPath, clean);
      const k = findKey(resolved);
      if (!k) return;

      const mime = mimeFromExt(resolved);
      const blob = new Blob([zip[k]], { type: mime });
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);

      img.setAttribute("src", url);
      // once we have a definite src, remove srcset to avoid browser picking stale candidates
      img.removeAttribute("srcset");
    });

    // ---- Rewire <svg><image href|xlink:href="..."> references: ----
    const svgImages = fragRoot.querySelectorAll("image");
    svgImages.forEach((node: Element) => {
      const rawHref =
        node.getAttribute("href") ||
        node.getAttribute("xlink:href") ||
        "";

      if (!rawHref) return;
      if (/^data:/i.test(rawHref) || /^https?:/i.test(rawHref)) return;

      const clean = rawHref.split("#")[0].split("?")[0];
      const resolved = resolveZipHref(absPath, clean);
      const k = findKey(resolved);
      if (!k) return;

      const mime = mimeFromExt(resolved);
      const blob = new Blob([zip[k]], { type: mime });
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);

      node.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", url);
      node.setAttribute("href", url);
      node.removeAttribute("xlink:href");
    });

    // innerHTML after sanitization
    const sectionHtml = fragRoot.innerHTML;

    // text extraction for TTS + mapping
    const textDoc = parser.parseFromString(sectionHtml, "text/html");
    const plain = (textDoc.body.textContent || "").replace(/\s+/g, " ").trim();

    // label: TOC label if present, else "Chapter N"
    const label =
      labelsByHref.get(absPath.toLowerCase()) || `Chapter ${i + 1}`;

    // Split very long chapters into parts for a better "Start from" dialog
    const MAX_CHAP = 3600;
    if (plain.length > MAX_CHAP * 1.2) {
      let chapStart = 0;
      let part = 1;
      while (chapStart < plain.length) {
        const chunkEnd = findWordSafeBreak(plain, chapStart, MAX_CHAP);
        const slice = plain.slice(chapStart, chunkEnd);
        const subId = `chap_${i + 1}_part_${part}`;
        sections.push({
          id: subId,
          label: `${label} — Part ${part}`,
          start: offset,
          end: offset + slice.length,
          preview: clampPreview(slice),
        });
        fullText += slice;
        offset += slice.length;
        chapStart = chunkEnd;
        part++;
      }
      // HTML: still keep as one <section> for preview (less DOM)
      fullHtmlParts.push(
        `<section id="ch-${i + 1}">${sectionHtml}</section>`
      );
    } else {
      sections.push({
        id: `chap_${i + 1}`,
        label,
        start: offset,
        end: offset + plain.length,
        preview: clampPreview(plain),
      });
      fullText += plain;
      offset += plain.length;

      fullHtmlParts.push(
        `<section id="ch-${i + 1}">${sectionHtml}</section>`
      );
    }
  }

  if (!fullText.trim()) {
    throw new Error("There was an error parsing the file! It might not have valid text content.");
  }

  const fullHtml = `<div class="epub-doc">${fullHtmlParts.join("\n")}</div>`;

  const structured: StructuredText = {
    fullText,
    fullHtml,
    sections,
    // IMPORTANT: treat EPUB like DOCX so the existing needle-based highlighter is used
    source: "docx",
  };

  _blobRegistry.set(structured as object, blobUrls);
  return structured;
};

/** Allow caller to revoke generated object URLs when done (optional but recommended) */
const revokeStructuredObjectURLs = (st: StructuredText | null | undefined) => {
  if (!st) return;
  const urls = _blobRegistry.get(st as object) || [];
  urls.forEach((u) => URL.revokeObjectURL(u));
  _blobRegistry.delete(st as object);
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
const pdfToText = async (file: File | Blob): Promise<string> => {
  const pages = await getPdfPages(file);
  const extractedText = pages.join(" ");
  if (extractedText.trim().length === 0) {
    throw new Error("There was an error parsing the file! It might not have valid text content.");
  }
  return extractedText;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getParagraphs(content: ArrayBuffer) {
  try {
    // For Firefox CSP compliance, use structured cloning to create a fresh ArrayBuffer
    // This avoids constructor property access issues that trigger CSP violations
    let freshBuffer: ArrayBuffer;
    try {
      // Try structured cloning first (best for Firefox)
      freshBuffer = structuredClone(content);
    } catch (cloneError) {
      // Fallback: manually copy bytes if structured clone fails
      const sourceView = new Uint8Array(content);
      freshBuffer = new ArrayBuffer(sourceView.length);
      const freshView = new Uint8Array(freshBuffer);
      freshView.set(sourceView);
    }
    
    const result = await mammoth.convertToHtml({ arrayBuffer: freshBuffer });
    return result.value;
  } catch (error: any) {
    console.error("[getParagraphs] Error converting DOCX:", error);
    // If it's a constructor permission error, provide a helpful message
    if (error?.message?.includes('constructor') || error?.message?.includes('Permission denied')) {
      throw new Error("DOCX parsing encountered a browser security restriction. Please try converting the file to a text file or use Chrome browser.");
    }
    throw new Error(error?.message || "There was an error parsing the DOCX file! It might be corrupted or use unsupported features.");
  }
}

const docxToText = async <T = string>(file: File): Promise<T | string> => {
  try {
    // Robust read with a FileReader fallback for NotReadableError cases.
    const arrayBuffer = await readArrayBuffer(file);

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("The file appears to be empty or could not be read.");
    }
    
    const text = await getParagraphs(arrayBuffer);
    if (text.trim().length > 0) return text as T;
    throw new Error("There was an error parsing the file! It might not have valid text content.");
  } catch (error: any) {
    console.error("[docxToText] Error reading DOCX:", error);
    throw error instanceof Error ? error : new Error("Failed to read the file. Please ensure it's a valid DOCX file.");
  }
};

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
  const pages = await getPdfPages(file);

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
    epubToStructured,    
    revokeStructuredObjectURLs, 
  };
}
