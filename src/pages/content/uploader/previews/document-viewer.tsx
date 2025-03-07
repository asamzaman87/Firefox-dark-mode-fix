import { FC, useEffect, useRef } from "react";

interface DocumentViewerProps {
    content: string;
}
const DocumentViewer: FC<DocumentViewerProps> = ({ content }) => {
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (content.trim()?.length && divRef.current) {
            divRef.current.innerHTML = content.split("\n").join("<br/>");
        }
    }, [content])

    return (
        <div className="text-[23px] size-full overflow-y-auto max-h-full text-justify [&_p]:my-4 [&_p]:leading-loose sm:px-[15%]">
            <div ref={divRef} className="p-10 mb-10 bg-white dark:bg-black min-h-full h-max rounded drop-shadow">

            </div>
        </div>
    )
}
export default DocumentViewer;