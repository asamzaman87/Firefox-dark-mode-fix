// src/pages/content/uploader/previews/document-viewer.tsx
import { FC, useEffect, useRef } from "react";

interface DocumentViewerProps {
  /** HTML to render (DOCX HTML from mammoth, or TXT converted to <br/>) */
  content: string;

  /** Whether the flash highlight is enabled (controlled upstream) */
  highlightActive?: boolean;

  /** Duration for flash highlight (ms). Default 4000. */
  highlightDurationMs?: number;

  /** If present, use *needle* (alphanum-only) matching instead of offset/length */
  highlightCharacters?: string;

  /** Alphanum characters that occur before highlightCharacters in the source (disambiguation) */
  highlightAlphaBefore?: number;

  highlightLength?: number;

  scrollToOffset?: number;

  highlightPulse?: number
}

const DocumentViewer: FC<DocumentViewerProps> = ({
  content,
  highlightActive = false,
  highlightDurationMs = 4000,
  highlightCharacters,
  highlightAlphaBefore,
  highlightLength,
  scrollToOffset,
  highlightPulse
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  // NOTE: make ref nullable; reset to null instead of undefined
  const cleanupRef = useRef<(() => void) | null>(null);

  /**
   * Robust needle locator around an approximate alnum position (floorK).
   * Strategy:
   *  1) Try strict indexOf from floorK.
   *  2) Expand a window around floorK (exponentially) and search inside it.
   *  3) If still not found, binary search on the needle length (prefix) within a bounded window.
   * Returns { idx, usedNeedleLen } where usedNeedleLen can be < needle.length if we had to trim.
   */
  function findIdxRobust(
    haystack: string,
    needle: string,
    floorK: number,
    opts?: { backLimit?: number; fwdLimit?: number; initialSpan?: number; minKeepFrac?: number }
  ): { idx: number; usedNeedleLen: number } {
    const backLimit = opts?.backLimit ?? 1200;     // how far back we’re willing to look
    const fwdLimit  = opts?.fwdLimit  ?? 1200;     // how far forward we’re willing to look
    const initial   = opts?.initialSpan ?? 96;     // starting window radius
    const minKeep   = opts?.minKeepFrac ?? 0.45;   // don’t trim below this fraction of the needle

    if (!needle) return { idx: -1, usedNeedleLen: 0 };

    const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

    // 1) Strict search from floorK
    let from = clamp(floorK, 0, haystack.length);
    let idx = haystack.indexOf(needle, from);
    if (idx >= 0) return { idx, usedNeedleLen: needle.length };

    // 2) Windowed search, exponentially expanding around floorK
    for (let span = initial; span <= Math.max(backLimit, fwdLimit); span *= 2) {
      const start = clamp(floorK - span, 0, haystack.length);
      const end   = clamp(floorK + span, 0, haystack.length);
      if (end <= start) break;
      const local = haystack.slice(start, end).indexOf(needle);
      if (local >= 0) return { idx: start + local, usedNeedleLen: needle.length };
    }

    // 3) Binary-search the *prefix length* within a bounded window around floorK
    const windowStart = clamp(floorK - backLimit, 0, haystack.length);
    const windowEnd   = clamp(floorK + fwdLimit,  0, haystack.length);
    const windowStr   = haystack.slice(windowStart, windowEnd);

    let lo = Math.ceil(needle.length * minKeep);
    let hi = needle.length - 1;
    let bestLocal = -1;
    let bestLen = 0;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const sub = needle.slice(0, mid);
      const pos = windowStr.indexOf(sub);
      if (pos >= 0) {
        bestLocal = pos;
        bestLen = mid;
        lo = mid + 1; // try to keep more
      } else {
        hi = mid - 1; // keep less
      }
    }

    if (bestLocal >= 0) {
      return { idx: windowStart + bestLocal, usedNeedleLen: bestLen };
    }

    // No occurrence found even after trimming — give up
    return { idx: -1, usedNeedleLen: 0 };
  }

  // Render HTML exactly (keeps images/formatting)
  useEffect(() => {
    if (!divRef.current) return;
    divRef.current.innerHTML = content ?? "";
  }, [content]);

  // HYBRID HIGHLIGHTER: prefers needle (autohighlight); falls back to offset+length (selection)
  useEffect(() => {
    const root = divRef.current;
    if (!root) return;

    // clear previous wraps on rerun
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (!highlightActive) return;

    // ---- Branch A: Needle mode (autohighlight) ----
    if (highlightCharacters && highlightCharacters.trim()) {
      // collect all text nodes
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
      if (!textNodes.length) { return; }
      // build alphanum stream → DOM points (AFTER-char offsets)
      type DomPoint = { node: Text; offset: number };
      const alphaToDom: DomPoint[] = [];
      const alphaChars: string[] = [];
      const isAlnum = (ch: string) => /\p{L}|\p{N}/u.test(ch);

      for (const node of textNodes) {
        const data = node.data || "";
        for (let i = 0; i < data.length; i++) {
          const ch = data[i];
          if (!isAlnum(ch)) continue;
          alphaChars.push(ch.toLowerCase());
          alphaToDom.push({ node, offset: i + 1 }); // AFTER this alnum
        }
      }
      if (!alphaChars.length) { return; }

      // normalize needle
      let needle = "";
      for (let i = 0; i < highlightCharacters.length; i++) {
        const ch = highlightCharacters[i];
        if (isAlnum(ch)) needle += ch.toLowerCase();
      }
      if (!needle) { return; }

      const alphaJoined = alphaChars.join("");

      // clamp floor to haystack bounds
      const floor = Math.min(Math.max(0, (highlightAlphaBefore ?? 0)), Math.max(0, alphaJoined.length));

      let idx = alphaJoined.indexOf(needle, floor);
      let usedNeedleLen = needle.length;

      if (idx < 0) {
        const { idx: ridx, usedNeedleLen: rlen } = findIdxRobust(alphaJoined, needle, floor, {
          // you can keep these tight, or make them wide; wide = “search whole doc”
          backLimit: 1500,
          fwdLimit: 1500,
          initialSpan: 128,
          minKeepFrac: 0.5,
        });

        if (ridx < 0) {
          console.warn("findIdxRobust: no match near expected region");
          return; // give up cleanly
        }

        idx = ridx;
        usedNeedleLen = rlen;
        // IMPORTANT: if we trimmed, use the trimmed prefix for the range
        needle = needle.slice(0, usedNeedleLen);
      }

      const startK = idx;
      const endK = idx + usedNeedleLen;

      // --- Build a DOM Range and SNAP endpoints inside text nodes ---
      const r = document.createRange();

      // Start at the text node that contains the first alnum of the needle,
      // and snap one char earlier *within the same text node* (clamped).
      const startPt = alphaToDom[Math.max(0, startK)];
      const startNode = startPt.node;
      const startOffset = Math.max(0, Math.min(startPt.offset - 1, startNode.data.length));
      r.setStart(startNode, startOffset);

      // End at the text node that contains the last alnum of the needle.
      const endPt = alphaToDom[Math.min(endK - 1, alphaToDom.length - 1)];
      const endNode = endPt.node;
      const endOffset = Math.max(0, Math.min(endPt.offset, endNode.data.length));
      r.setEnd(endNode, endOffset);

      // Helper to center on a target + recenter after layout shifts
      const centerWithRelayout = (target: HTMLElement) => {
        let raf = 0;
        const pendingImgs: HTMLImageElement[] = [];
        let onImgLoad: ((e: Event) => void) | null = null;
        const center = (behavior: ScrollBehavior = "auto") =>
          target.scrollIntoView({ block: "center", inline: "nearest", behavior });

        center("auto");
        raf = requestAnimationFrame(() => center("auto"));

        const imgs = Array.from(root.querySelectorAll("img"));
        onImgLoad = () => center("auto");
        imgs.forEach((img) => {
          if (!img.complete) {
            pendingImgs.push(img);
            img.addEventListener("load", onImgLoad!, { once: true });
          }
        });

        return {
          dispose: () => {
            cancelAnimationFrame(raf);
            if (onImgLoad) pendingImgs.forEach((img) => img.removeEventListener("load", onImgLoad));
          },
        };
      };

      // Create one highlight span factory
      const mkWrap = () => {
        const span = document.createElement("span");
        span.style.background = "rgba(250,204,21,.45)";
        span.style.borderRadius = "4px";
        span.style.padding = "0 .15rem";
        return span;
      };

      // Try the simple path first
      let wrappers: HTMLElement[] = [];
      let cleanupRelayout: { dispose: () => void } | null = null;
      let timer: number | null = null;

      const trySurround = () => {
        const wrap = mkWrap();
        try {
          // Will throw InvalidStateError if the range splits elements
          r.surroundContents(wrap);
          wrappers = [wrap];
          cleanupRelayout = centerWithRelayout(wrap);
          return true;
        } catch {
          return false;
        }
      };

      const fallbackWrapByTextNodes = () => {
        // 1) SNAPSHOT candidates BEFORE any DOM mutation
        const candidates: Text[] = [];
        {
          const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          while (tw.nextNode()) {
            const node = tw.currentNode as Text;
            if ((r as any).intersectsNode?.(node)) candidates.push(node);
          }
        }

        // 2) Now mutate/wrap using the frozen list
        const localWraps: HTMLElement[] = [];
        for (const node of candidates) {
          const isStart = node === r.startContainer;
          const isEnd   = node === r.endContainer;

          const s = isStart ? (r.startOffset || 0) : 0;
          const e = isEnd ? (r.endOffset || node.data.length) : node.data.length;

          if (e <= s) continue;

          const mid = node.splitText(s);
          mid.splitText(e - s);

          const wrap = mkWrap();
          mid.parentNode?.insertBefore(wrap, mid);
          wrap.appendChild(mid);
          localWraps.push(wrap);
        }

        wrappers = localWraps;
        if (wrappers[0]) cleanupRelayout = centerWithRelayout(wrappers[0]);
      };
      if (!trySurround()) {
        fallbackWrapByTextNodes();
      }

      if (!wrappers.length) return;
      timer = window.setTimeout(() => {
        for (const w of wrappers) {
          const parent = w.parentNode;
          if (!parent) continue;
          while (w.firstChild) parent.insertBefore(w.firstChild, w);
          parent.removeChild(w);
        }
      }, highlightDurationMs);

      cleanupRef.current = () => {
        if (timer != null) window.clearTimeout(timer);
        cleanupRelayout?.dispose();
        for (const w of wrappers) {
          const parent = w.parentNode;
          if (!parent) continue;
          while (w.firstChild) parent.insertBefore(w.firstChild, w);
          parent.removeChild(w);
        }
      };

      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
      };
    }

    // ---- Branch B: Legacy absolute offset + length (selection) ----
    const start = Math.max(0, scrollToOffset ?? 0);
    const len = Math.max(0, highlightLength ?? 0);
    if (len === 0) return;

    // collect text nodes with absolute positions
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; begin: number; end: number }[] = [];
    let acc = 0;
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = (n as Text).data ?? "";
      nodes.push({ node: n as Text, begin: acc, end: acc + t.length });
      acc += t.length;
    }
    if (acc === 0) return;

    const hiStart = start;
    const hiEnd = Math.min(acc, start + len);
    if (hiEnd <= hiStart) return;

    const intersect = (a0: number, a1: number, b0: number, b1: number) => {
      const s = Math.max(a0, b0);
      const e = Math.min(a1, b1);
      return e > s ? ([s, e] as const) : null;
    };

    const wrappers: HTMLSpanElement[] = [];

    for (const { node, begin, end } of nodes) {
      const ov = intersect(begin, end, hiStart, hiEnd);
      if (!ov) continue;

      const [ovStartAbs, ovEndAbs] = ov;
      const localStart = ovStartAbs - begin;
      const localEnd = ovEndAbs - begin;

      const mid = node.splitText(localStart);
      mid.splitText(localEnd - localStart);

      const wrap = document.createElement("span");
      wrap.style.background = "rgba(250,204,21,.45)";
      wrap.style.borderRadius = "4px";
      wrap.style.padding = "0 .15rem";

      mid.parentNode?.insertBefore(wrap, mid);
      wrap.appendChild(mid);

      wrappers.push(wrap);
    }

    // center first wrapper and recenter on layout shifts
    let raf = 0;
    const pendingImgs: HTMLImageElement[] = [];
    let onImgLoad: ((e: Event) => void) | null = null;

    if (wrappers[0]) {
      const target = wrappers[0];
      const center = (behavior: ScrollBehavior = "auto") =>
        target.scrollIntoView({ block: "center", inline: "nearest", behavior });

      center("auto");
      raf = requestAnimationFrame(() => center("auto"));

      const rootEl = divRef.current!;
      const imgs = Array.from(rootEl.querySelectorAll("img"));
      onImgLoad = () => center("auto");
      imgs.forEach((img) => {
        if (!img.complete) {
          pendingImgs.push(img);
          img.addEventListener("load", onImgLoad!, { once: true });
        }
      });
    }

    const timer = window.setTimeout(() => {
      for (const w of wrappers) {
        const parent = w.parentNode;
        if (!parent) continue;
        while (w.firstChild) parent.insertBefore(w.firstChild, w);
        parent.removeChild(w);
      }
    }, highlightDurationMs);

    cleanupRef.current = () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      if (onImgLoad) pendingImgs.forEach((img) => img.removeEventListener("load", onImgLoad));
      for (const w of wrappers) {
        const parent = w.parentNode;
        if (!parent) continue;
        while (w.firstChild) parent.insertBefore(w.firstChild, w);
        parent.removeChild(w);
      }
    };

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [
    content,
    highlightActive,
    highlightCharacters,
    highlightAlphaBefore,
    highlightPulse,
    // legacy selection path
    scrollToOffset,
    highlightLength,
    highlightDurationMs,
  ]);


  return (
    <div 
      className="gpt:text-[23px] gpt:size-full gpt:overflow-y-auto gpt:max-h-full gpt:text-justify gpt:[&_p]:my-4 gpt:[&_p]:leading-loose gpt:sm:px-[15%]"
      style={{ 
        overflowAnchor: 'none',
        overscrollBehavior: 'contain',
        scrollBehavior: 'auto',
      }}
    >
      <div
        ref={divRef}
        className="gpt:p-10 gpt:mb-32 gpt:bg-white dark:bg-black gpt:min-h-full gpt:h-max gpt:rounded gpt:drop-shadow"
      />
    </div>
  );
};

export default DocumentViewer;
