import { FC, useEffect, useRef } from "react";

interface DocumentViewerProps {
    content: string;
}
const DocumentViewer: FC<DocumentViewerProps> = ({ content }) => {
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (content.trim()?.length && divRef.current) {
            divRef.current.innerHTML = content;
        }
    }, [content])

    return (
        <div ref={divRef} className="text-[23px] size-full overflow-y-auto max-h-full text-justify [&_p]:my-4 [&_p]:leading-loose px-[15%]">
        </div>
    )
}
export default DocumentViewer;