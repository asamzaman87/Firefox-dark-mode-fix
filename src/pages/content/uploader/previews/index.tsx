import { FC } from "react";
import DocumentViewer from "./document-viewer";
import PdfViewer from "./pdf-viewer";

interface PreviewsProps {
    file: File | null;
    content: string;
}

const Previews: FC<PreviewsProps> = ({ file, content }) => {

    if (file?.type.includes("pdf")) {
        return <PdfViewer file={file} />
    }
    return <DocumentViewer content={content} />
}

export default Previews;