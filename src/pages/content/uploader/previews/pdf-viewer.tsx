import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2Icon } from 'lucide-react';
import { FC, useState } from 'react';
import { Document, Page } from 'react-pdf';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// function highlightPattern(text: string, pattern: string) {
//     return text.replace(pattern, (value: ReactNode) => `<mark>${value}</mark>`);
// }

interface PdfViewerProps {
    file: File;
}

const PdfViewer: FC<PdfViewerProps> = ({ file }) => {

    const samplePDF = file;
    // const [searchText, setSearchText] = useState('');
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState(1);

    // const textRenderer = useCallback(
    //     (textItem: { str: string; }) => highlightPattern(textItem.str, searchText),
    //     [searchText]
    // );

    // function onChange(event: { target: { value: React.SetStateAction<string>; }; }) {
    //     setSearchText(event.target.value);
    // }

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setPageNumber(1);
    }

    function changePage(offset: number) {
        setPageNumber(prevPageNumber => prevPageNumber + offset);
    }

    function previousPage() {
        changePage(-1);
    }

    function nextPage() {
        changePage(1);
    }


    return (
        <div className='gpt:flex gpt:flex-row gpt:justify-center gpt:items-center gpt:gap-2 gpt:size-full'>
            <Button
                className="hover:gpt:scale-115 active:gpt:scale-105 gpt:transition-all gpt:[&_svg]:size-6 gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800"
                variant={"ghost"}
                size={"icon"}
                disabled={pageNumber <= 1}
                onClick={previousPage}
            >
                <span className="gpt:sr-only">Previous</span>
                <ChevronLeft />
            </Button>

            <div className="gpt:flex gpt:flex-col gpt:gap-2 gpt:relative gpt:overflow-y-auto gpt:max-h-full">
                <span className="gpt:z-10 gpt:fixed gpt:bottom-2 gpt:right-32 gpt:px-4 gpt:py-2 gpt:text-sm gpt:font-medium gpt:text-muted-foreground gpt:text-center gpt:mx-auto gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:shadow">
                    Page {pageNumber || (numPages ? 1 : '--')} of {numPages || '--'}
                </span>
                <Document file={samplePDF} onLoadSuccess={onDocumentLoadSuccess}>
                    <Page className={"gpt:mb-32! gpt:mx-0.5! gpt:mt-0.5! gpt:rounded! gpt:drop-shadow! gpt:[&>canvas]:rounded!"}  pageNumber={pageNumber} loading={<div className="gpt:h-[628.5px] gpt:w-[393.4786px] gpt:flex gpt:items-center gpt:justify-center"><Loader2Icon className='gpt:size-6 gpt:animate-spin' /></div>} />
                </Document>
            </div>

            <Button
                className="hover:gpt:scale-115 active:gpt:scale-105 gpt:transition-all gpt:[&_svg]:size-6 gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800"
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
}

export default PdfViewer;