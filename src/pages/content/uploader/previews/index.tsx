import { FC, memo } from "react";
import DocumentViewer from "./document-viewer";
import ReaderDownloadPreview from "./download-preview";
import TranscriberDownloadPreview from "./transcriber-download-preview";
import PdfViewer from "./pdf-viewer";
import { useSpeechMode } from "../../../../context/speech-mode";
interface PreviewsProps {
    file: File | null;
    content: string;
    isDowloading?: boolean;
    progress?: number;
    onDownload?: () => void;
    onDownloadCancel?: () => void;
    downloadPreviewText?: string;
    downloadCancelConfirmation: boolean;
    setDownloadCancelConfirmation: (state: boolean) => void;
}

const Previews: FC<PreviewsProps> = ({setDownloadCancelConfirmation, downloadCancelConfirmation,  downloadPreviewText, file, content, isDowloading, progress, onDownload, onDownloadCancel }) => {
    const {isTextToSpeech} = useSpeechMode();

    if (isDowloading) {
        return isTextToSpeech ? (
            <ReaderDownloadPreview
                setDownloadCancelConfirmation={setDownloadCancelConfirmation}
                downloadCancelConfirmation={downloadCancelConfirmation}
                text={downloadPreviewText ?? ""}
                progress={progress ?? 0}
                fileName={file?.name ?? ""}
                onDownload={onDownload}
                onCancel={onDownloadCancel}
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

    if (isTextToSpeech && file?.type.includes("pdf")) {
        return <PdfViewer file={file} />
    }
    return  isTextToSpeech ? <DocumentViewer content={content} /> : null;
}

export default memo(Previews);