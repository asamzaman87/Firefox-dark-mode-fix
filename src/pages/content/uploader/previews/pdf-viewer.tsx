import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2Icon } from 'lucide-react';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import type { SectionIndex } from '@/hooks/use-file-reader';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PdfViewerProps {
  file: File;

  /** Optional: 1-based page to show first */
  initialPage?: number;

  /** Optional: page boundaries (for mapping global offset -> page local offset) */
  sections?: SectionIndex[];

  /** Optional: global character offset where playback starts */
  startOffset?: number;

  /** Optional: how many chars to highlight (multi-word) */
  highlightLength?: number;

  /** Enable temporary word/phrase highlight (only when listening & not “start from beginning”) */
  highlightEnabled?: boolean;

  /** How long the highlight stays visible (ms). Default: 4000 */
  highlightDurationMs?: number;

  highlightPulse?: number
}

const PdfViewer: FC<PdfViewerProps> = ({
  file,
  initialPage,
  sections,
  startOffset,
  highlightLength = 0,
  highlightEnabled = false,
  highlightDurationMs = 4000,
  highlightPulse
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [flashOn, setFlashOn] = useState(false);

  // ensure we only flash once per startOffset selection
  const flashedOnceRef = useRef(false);
  // remember the last startOffset we jumped for
  const awaitingPulseRef = useRef<number | null>(null);
  const prevPulsesRef = useRef<Set<number>>(new Set());

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(initialPage ? Math.min(Math.max(initialPage, 1), numPages) : 1);
  }

  function changePage(offset: number) {
    setPageNumber(prevPageNumber => prevPageNumber + offset);
  }
  function previousPage() { changePage(-1); }
  function nextPage() { changePage(1); }

  // Determine the 1-based page that contains startOffset (if any)
  const targetPage = useMemo(() => {
    if (!sections || startOffset == null) return undefined;
    const idx = sections.findIndex(s => startOffset >= s.start && startOffset < s.end);
    return idx >= 0 ? idx + 1 : undefined;
  }, [sections, startOffset]);

  // Local offset inside the target page, matching the TTS page string that was built with "items.join(' ')"
  const localOffsetWithSpaces = useMemo(() => {
    if (!sections || startOffset == null || !targetPage) return undefined;
    const sec = sections[targetPage - 1];
    return Math.max(0, startOffset - sec.start);
  }, [sections, startOffset, targetPage]);

    // Only trigger the flash once (per startOffset). Don’t re-flash when returning to the page.
    useEffect(() => {
        // Flash ONLY when the user chose a selection (highlightLength > 0),
        // and never when they clicked "Start from beginning" (highlightLength === 0).
        const shouldFlash =
            !!highlightEnabled &&
            (highlightLength ?? 0) > 0 &&
            !!targetPage &&
            pageNumber === targetPage;

        if (shouldFlash && !flashedOnceRef.current) {
            setFlashOn(true);
            flashedOnceRef.current = true;
        } else {
            setFlashOn(false);
        }
    }, [highlightEnabled, highlightLength, targetPage, pageNumber, highlightDurationMs]);

  // Simple HTML escaper for customTextRenderer
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /**
   * Accurate multi-item highlight mapping
   *
   * TTS page text was built with a single "join space" between items: items.join(" ")
   * The PDF text layer items don't include those join spaces. For the N-th item,
   * the TTS string has N extra characters before it.
   *
   * beginWithSpaces = sum(lengths of items before) + itemIndex
   * endWithSpaces   = beginWithSpaces + currentItem.length
   */
  const textRenderer = useMemo(() => {
    if (!flashOn || targetPage == null || pageNumber !== targetPage) return undefined;

    const wantsPhrase = (highlightLength ?? 0) > 0;
    const startWithSpaces = Math.max(0, localOffsetWithSpaces ?? 0);
    const isPageStartOnLaterPage = !wantsPhrase && (startWithSpaces === 0) && (targetPage > 1);

    let cumulativeNoSpaces = 0; // sum of previous item lengths (no spaces)
    let itemIndex = 0;          // current item index
    let started = false;        // started highlighting
    let remaining = Math.max(0, highlightLength || 0);

    return (textItem: { str: string }) => {
      const str = textItem.str || '';
      const beginNoSpaces = cumulativeNoSpaces;
      const endNoSpaces = beginNoSpaces + str.length;

      // translate to the TTS page string coordinate system (with single join spaces)
      const beginWithSpaces = beginNoSpaces + itemIndex;
      const endWithSpaces = endNoSpaces + itemIndex;

      cumulativeNoSpaces = endNoSpaces;
      itemIndex += 1;

      // A) first-word flash for page start (page 2+ only) when no explicit match length
      if (!wantsPhrase && isPageStartOnLaterPage && !started) {
        const m = str.match(/^\s*(\S+)/);
        if (m && m[1]) {
          const lead = m[0].length - m[1].length; // leading whitespace length
          const w = m[1].length;
          started = true;
          return `${esc(str.slice(0, lead))}<span style="background:rgba(250,204,21,.45);border-radius:4px;padding:0 .15rem">${esc(
            str.slice(lead, lead + w)
          )}</span>${esc(str.slice(lead + w))}`;
        }
        return esc(str);
      }

      // B) multi-word/phrase highlight starting at startWithSpaces
      if (wantsPhrase) {
        if (!started) {
          const onJoinSpace = startWithSpaces === beginWithSpaces - 1;
          const insideThisItem = startWithSpaces >= beginWithSpaces && startWithSpaces < endWithSpaces;

          if (!(insideThisItem || onJoinSpace)) {
            return esc(str);
          }

          started = true;
          const startIdxInItem = onJoinSpace ? 0 : (startWithSpaces - beginWithSpaces);
          const take = Math.min(remaining, Math.max(0, str.length - startIdxInItem));

          const before = esc(str.slice(0, startIdxInItem));
          const target = esc(str.slice(startIdxInItem, startIdxInItem + take));
          const rest = esc(str.slice(startIdxInItem + take));

          remaining -= take;
          return `${before}<span style="background:rgba(250,204,21,.45);border-radius:4px;padding:0 .15rem">${target}</span>${rest}`;
        }

        if (remaining > 0) {
          const take = Math.min(remaining, str.length);
          const target = esc(str.slice(0, take));
          const rest = esc(str.slice(take));
          remaining -= take;
          return `<span style="background:rgba(250,204,21,.45);border-radius:4px;padding:0 .15rem">${target}</span>${rest}`;
        }

        return esc(str);
      }

      return esc(str);
    };
  }, [flashOn, pageNumber, targetPage, localOffsetWithSpaces, highlightLength]);

    useEffect(() => {
      if (!flashOn) return;
      const t = window.setTimeout(() => setFlashOn(false), highlightDurationMs);
      return () => window.clearTimeout(t);
    }, [flashOn, highlightDurationMs]);
  
  // One-shot auto-jump for the current pulse; then get out of the way of Next/Prev
    useEffect(() => {
      if (!highlightEnabled) return;
      if (startOffset == null) return;
      if (!targetPage) return;
      if (!highlightPulse) return;
      if (prevPulsesRef.current.has(highlightPulse)) return;

      if (pageNumber !== targetPage) {
        // Jump first; defer the flash until page render completes
        awaitingPulseRef.current = highlightPulse;
        setPageNumber(targetPage);
        return;
      }

      // Already on the correct page → flash now
      prevPulsesRef.current.add(highlightPulse);
      setFlashOn(true);
    }, [highlightEnabled, startOffset, targetPage, pageNumber, highlightPulse]);


  return (
    <div className='gpt:flex gpt:flex-row gpt:justify-center gpt:items-center gpt:gap-2 gpt:size-full'>
      <Button
        className="gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:[&_svg]:size-6 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800"
        variant={"ghost"}
        size={"icon"}
        disabled={pageNumber <= 1}
        onClick={previousPage}
      >
        <span className="gpt:sr-only">Previous</span>
        <ChevronLeft />
      </Button>

      <div className="gpt:flex gpt:flex-col gpt:gap-2 gpt:relative gpt:overflow-y-auto gpt:max-h-full">
        <span className="gpt:z-10 gpt:fixed gpt:bottom-2 gpt:left-36 gpt:px-4 gpt:py-2 gpt:text-sm gpt:font-medium gpt:text-muted-foreground gpt:text-center gpt:mx-auto gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:shadow">
          Page {pageNumber || (numPages ? 1 : '--')} of {numPages || '--'}
        </span>
        <Document file={file} onLoadSuccess={onDocumentLoadSuccess}>
          <Page
            className={"gpt:mb-32! gpt:mx-0.5! gpt:mt-0.5! gpt:rounded! gpt:drop-shadow! gpt:[&>canvas]:rounded!"}
            pageNumber={pageNumber}
            loading={
              <div className="gpt:h-[628.5px] gpt:w-[393.4786px] gpt:flex gpt:items-center gpt:justify-center">
                <Loader2Icon className='gpt:size-6 gpt:animate-spin' />
              </div>
            }
            // Only provide renderer when flashing; otherwise render normal text
            customTextRenderer={flashOn ? textRenderer : undefined}
            onRenderSuccess={() => {
              // If a pulse is waiting and we’re now on its target page, flash once.
              if (
                awaitingPulseRef.current != null &&
                awaitingPulseRef.current === highlightPulse &&
                pageNumber === targetPage &&
                !prevPulsesRef.current.has(highlightPulse!)
              ) {
                prevPulsesRef.current.add(highlightPulse!);
                awaitingPulseRef.current = null;
                setFlashOn(true); // universal 4s timer will handle duration/cleanup
              }
            }}
          />
        </Document>
      </div>

      <Button
        className="gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all gpt:[&_svg]:size-6 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800"
        variant={"ghost"}
        size={"icon"}
        disabled={pageNumber >= numPages}
        onClick={nextPage}
      >
        <span className="gpt:sr-only">Next</span>
        <ChevronRight />
      </Button>
    </div>
  );
};

export default PdfViewer;
