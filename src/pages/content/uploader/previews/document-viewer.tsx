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
        <div className="gpt:text-[23px] gpt:size-full gpt:overflow-y-auto gpt:max-h-full gpt:text-justify gpt:[&_p]:my-4 gpt:[&_p]:leading-loose gpt:sm:px-[15%]">
            <div ref={divRef} className="gpt:p-10 gpt:mb-32 gpt:bg-white dark:bg-black gpt:min-h-full gpt:h-max gpt:rounded gpt:drop-shadow">

            </div>
        </div>
    )
}
export default DocumentViewer;