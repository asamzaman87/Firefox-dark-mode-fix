import { FC, memo, useMemo } from "react";
import DocumentViewer from "./document-viewer";
import TranscriberDownloadPreview from "./transcriber-download-preview";
import PdfViewer from "./pdf-viewer";
import { useSpeechMode } from "../../../../context/speech-mode";
import type { SectionIndex } from "@/hooks/use-file-reader";
import DownloadPreview from "./download-preview";

// On Firefox the react-pdf canvas preview can't render: its worker is created
// from a blob/extension URL that the host page CSP (trusted-types) blocks. Fall
// back to the extracted-text preview there instead of crashing the overlay.
const isFirefox =
  typeof navigator !== "undefined" && /Firefox/.test(navigator.userAgent);

interface PreviewsProps {
  file?: File | null;

  /** Plain text (full document). */
  content: string;

  /** Rich HTML for DOCX/TXT (kept for listening preview formatting/images). */
  contentHtml?: string;

  isDowloading?: boolean;
  progress?: number;
  onDownload?: () => void;
  onDownloadCancel?: () => void;

  /** Progressive text showing what's been downloaded so far (for progress UI). */
  downloadPreviewText?: string;

  downloadCancelConfirmation: boolean;
  setDownloadCancelConfirmation: (state: boolean) => void;

  /** Character offset to scroll/jump to (listening view only). */
  scrollToOffset?: number;

  /** Multi-word highlight length (listening view only). */
  highlightLength?: number;

  /** Whether to show the temporary highlight (listening view only). */
  highlightActive?: boolean;

  /** Section/page boundaries (for PDFs, listening view only). */
  sections?: SectionIndex[] | null;

  downloadPreviewHtml?: string;

  highlightCharacters?: string;

  highlightAlphaBefore?: number;

  highlightPulse?: number

  showFirstChunkRatingPopup?: boolean;
  onFirstChunkRatingClose?: () => void;
  onFirstChunkRatingSubmit?: (rating: number) => void;
  onFirstChunkRatingInteractionStart?: () => void;
}

const Previews: FC<PreviewsProps> = ({
  setDownloadCancelConfirmation,
  downloadCancelConfirmation,
  file,
  content,
  contentHtml,
  isDowloading,
  progress,
  onDownload,
  onDownloadCancel,
  downloadPreviewText,
  scrollToOffset,
  highlightLength,
  highlightActive,
  sections,
  downloadPreviewHtml,
  highlightCharacters,
  highlightAlphaBefore,
  highlightPulse,
  showFirstChunkRatingPopup,
  onFirstChunkRatingClose,
  onFirstChunkRatingSubmit,
  onFirstChunkRatingInteractionStart
}) => {
  const { isTextToSpeech } = useSpeechMode();

  // ---- Downloading view (show EXACT TTS text; no HTML slicing) ----------
  if (isDowloading) {
    return isTextToSpeech ? (
      <DownloadPreview
        text={downloadPreviewText ?? ""} // ← exact string TTS sent (no HTML)
        html={downloadPreviewHtml} 
        progress={progress ?? 0}
        fileName={file?.name ?? ""}
        onDownload={onDownload}
        onCancel={onDownloadCancel}
        setDownloadCancelConfirmation={setDownloadCancelConfirmation}
        downloadCancelConfirmation={downloadCancelConfirmation}
        showFirstChunkRatingPopup={showFirstChunkRatingPopup}
        onFirstChunkRatingClose={onFirstChunkRatingClose}
        onFirstChunkRatingSubmit={onFirstChunkRatingSubmit}
        onFirstChunkRatingInteractionStart={onFirstChunkRatingInteractionStart}
      />
    ) : (
      <TranscriberDownloadPreview
        setDownloadCancelConfirmation={setDownloadCancelConfirmation}
        downloadCancelConfirmation={downloadCancelConfirmation}
        text={downloadPreviewText ?? ""}
        progress={progress ?? 0}
        fileName={file?.name ?? ""}
        onCancel={onDownloadCancel}
      />
    );
  }

  // ---- Listening view (keep your rich formatting & features) ------------
  const initialPdfPage = useMemo(() => {
    if (!scrollToOffset || !sections || !sections.length) return undefined;
    const i = sections.findIndex(
      (s) => scrollToOffset >= s.start && scrollToOffset < s.end
    );
    return i >= 0 ? i + 1 : undefined;
  }, [scrollToOffset, sections]);

  if (isTextToSpeech && file?.type.includes("pdf") && !isFirefox) {
    return (
      <PdfViewer
        file={file}
        initialPage={initialPdfPage}
        sections={sections ?? undefined}
        startOffset={scrollToOffset}
        highlightLength={highlightLength}
        highlightEnabled={!!highlightActive}
        highlightPulse={highlightPulse}
      />
    );
  }

  return isTextToSpeech ? (
    <DocumentViewer
      // prefer rich formatting for LISTENING view
      content={contentHtml ?? content.replace(/\n/g, "<br/>")}
      highlightActive={!!highlightActive}
      highlightDurationMs={4000}
      highlightCharacters={highlightCharacters}
      highlightAlphaBefore={highlightAlphaBefore}
      highlightLength={highlightLength}
      scrollToOffset={scrollToOffset}
      highlightPulse={highlightPulse}
    />
  ) : null;
};

export default memo(Previews);
