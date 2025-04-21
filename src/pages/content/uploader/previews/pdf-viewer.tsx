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
        <div className='flex flex-row justify-center items-center gap-2 size-full'>
            <Button
                className="hover:scale-115 active:scale-105 transition-all [&_svg]:size-6 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                variant={"ghost"}
                size={"icon"}
                disabled={pageNumber <= 1}
                onClick={previousPage}
            >
                <span className="sr-only">Previous</span>
                <ChevronLeft />
            </Button>

            <div className="flex flex-col gap-2 relative overflow-y-auto max-h-full">
                <span className="z-10 fixed bottom-2 right-32 px-4 py-2 text-sm font-medium text-muted-foreground text-center mx-auto rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow">
                    Page {pageNumber || (numPages ? 1 : '--')} of {numPages || '--'}
                </span>
                <Document file={samplePDF} onLoadSuccess={onDocumentLoadSuccess}>
                    <Page className={"mb-32! mx-0.5! mt-0.5! rounded! drop-shadow! [&>canvas]:rounded!"}  pageNumber={pageNumber} loading={<div className="h-[628.5px] w-[393.4786px] flex items-center justify-center"><Loader2Icon className='size-6 animate-spin' /></div>} />
                </Document>
            </div>

            <Button
                className="hover:scale-115 active:scale-105 transition-all [&_svg]:size-6 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                variant={"ghost"}
                size={"icon"}
                disabled={pageNumber >= numPages}
                onClick={nextPage}
            >
                <span className="sr-only">Next</span>
                <ChevronRight />
            </Button>
        </div>
    );
}

export default PdfViewer;