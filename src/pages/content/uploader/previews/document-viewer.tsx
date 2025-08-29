// src/pages/content/uploader/previews/document-viewer.tsx
import { FC, useEffect, useRef } from "react";

interface DocumentViewerProps {
  /** HTML to render (DOCX HTML from mammoth, or TXT converted to <br/>) */
  content: string;

  /** Absolute char offset into the *plain text* of content where reading starts */
  scrollToOffset?: number;

  /** How many characters to highlight (can be multi-word) */
  highlightLength?: number;

  /** Whether the flash highlight is enabled (controlled upstream) */
  highlightActive?: boolean;

  /** Duration for flash highlight (ms). Default 4000. */
  highlightDurationMs?: number;
}

const DocumentViewer: FC<DocumentViewerProps> = ({
  content,
  scrollToOffset,
  highlightLength = 0,
  highlightActive = false,
  highlightDurationMs = 4000,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  // NOTE: make ref nullable; reset to null instead of undefined
  const cleanupRef = useRef<(() => void) | null>(null);

  // Render HTML exactly (keeps images/formatting)
  useEffect(() => {
    if (!divRef.current) return;
    divRef.current.innerHTML = content ?? "";
  }, [content]);

  /**
   * Split-and-wrap highlighter:
   * - Walks text nodes and maintains an absolute text cursor
   * - For each node overlapping [start, start+len), split and wrap the middle
   * - Scrolls first highlight into view
   * - Unwraps after highlightDurationMs
   */
  useEffect(() => {
    const root = divRef.current;
    if (!root) return;

    // Clean up any previous highlight if the effect re-runs
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const start = Math.max(0, scrollToOffset ?? 0);
    const len = Math.max(0, highlightLength ?? 0);

    if (!highlightActive || len === 0) return;

    // Collect text nodes with their absolute ranges
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; begin: number; end: number }[] = [];
    let acc = 0;
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = (n as Text).data ?? "";
      const begin = acc;
      const end = begin + t.length;
      nodes.push({ node: n as Text, begin, end });
      acc = end;
    }
    if (acc === 0) return; // no text to highlight

    const hiStart = start;
    const hiEnd = Math.min(acc, start + len);

    // Helper to clamp intersection
    const intersect = (a0: number, a1: number, b0: number, b1: number) => {
      const s = Math.max(a0, b0);
      const e = Math.min(a1, b1);
      return e > s ? ([s, e] as const) : null;
    };

    // Keep wrappers so we can unwrap later
    const wrappers: HTMLSpanElement[] = [];

    for (const { node, begin, end } of nodes) {
      const ov = intersect(begin, end, hiStart, hiEnd);
      if (!ov) continue;

      const [ovStartAbs, ovEndAbs] = ov;
      const localStart = ovStartAbs - begin;
      const localEnd = ovEndAbs - begin;

      // Split the text node into [before][mid][after]
      const mid = node.splitText(localStart); // node(now before), mid(after split)
      const after = mid.splitText(localEnd - localStart); // mid, after

      // Wrap the 'mid' part
      const wrap = document.createElement("span");
      wrap.style.background = "rgba(250,204,21,.45)"; // amber-ish
      wrap.style.borderRadius = "4px";
      wrap.style.padding = "0 .15rem";

      mid.parentNode?.insertBefore(wrap, mid);
      wrap.appendChild(mid);

      wrappers.push(wrap);
    }

    // Scroll first highlight into view
    if (wrappers[0]) {
      wrappers[0].scrollIntoView({ block: "center", behavior: "smooth" });
    }

    // Schedule unwrap
    const timer = window.setTimeout(() => {
      for (const w of wrappers) {
        const parent = w.parentNode;
        if (!parent) continue;
        while (w.firstChild) parent.insertBefore(w.firstChild, w);
        parent.removeChild(w);
      }
    }, highlightDurationMs);

    // Provide cleanup for effect re-run/unmount
    cleanupRef.current = () => {
      window.clearTimeout(timer);
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
  }, [scrollToOffset, highlightLength, highlightActive, highlightDurationMs]);

  return (
    <div className="gpt:text-[23px] gpt:size-full gpt:overflow-y-auto gpt:max-h-full gpt:text-justify gpt:[&_p]:my-4 gpt:[&_p]:leading-loose gpt:sm:px-[15%]">
      <div
        ref={divRef}
        className="gpt:p-10 gpt:mb-32 gpt:bg-white dark:bg-black gpt:min-h-full gpt:h-max gpt:rounded gpt:drop-shadow"
      />
    </div>
  );
};

export default DocumentViewer;
