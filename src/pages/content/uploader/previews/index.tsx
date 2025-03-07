import { FC, memo } from "react";
import DocumentViewer from "./document-viewer";
import DownloadPreview from "./dowload-preview";
import PdfViewer from "./pdf-viewer";

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
    if (isDowloading) {
        return <DownloadPreview setDownloadCancelConfirmation={setDownloadCancelConfirmation} downloadCancelConfirmation={downloadCancelConfirmation} text={downloadPreviewText ?? ""}  progress={progress ?? 0} fileName={file?.name ?? ""}  onDownload={onDownload} onCancel={onDownloadCancel} />
    }

    if (file?.type.includes("pdf")) {
        return <PdfViewer file={file} />
    }
    return <DocumentViewer content={content} />
}

export default memo(Previews);