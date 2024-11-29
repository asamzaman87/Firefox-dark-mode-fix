import mammoth from "mammoth";
import { pdfjs } from "react-pdf";

// Path to the pdf.worker.js file
pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("pdf.worker.js");

const pdfToText = async (file: File | Blob | MediaSource): Promise<string> => {
    // Create a blob URL for the PDF file
    const blobUrl = URL.createObjectURL(file);

    // Load the PDF file
    const loadingTask = pdfjs.getDocument(blobUrl);

    let extractedText = "";
    let hadParsingError = false;
    try {
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        // Iterate through each page and extract text
        for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
            const page = await pdf.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ");
            extractedText += pageText;
        }
    } catch (e: unknown) {
        hadParsingError = true;
    }

    // Clean up the blob URL
    URL.revokeObjectURL(blobUrl);

    // Free memory from loading task
    loadingTask.destroy();

    if (!hadParsingError) {
        return extractedText;
    }
    throw new Error("There was an error parsing the file! It might not have valid text content.");
};

// Get paragraphs as javascript array
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getParagraphs(content: any) {
    const result = await mammoth.convertToHtml({ arrayBuffer: content });
    return result.value;
}

const docxToText = async <T = string>(file: File): Promise<T | string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e: ProgressEvent<FileReader>) => {
            const content = e.target?.result as ArrayBuffer;
            const text = await getParagraphs(content);
            if(text.trim().length > 0) return resolve(text);
            reject(new Error("There was an error parsing the file! It might not have valid text content."));
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });

const textPlainToText = async (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e: ProgressEvent<FileReader>) => {
            if (file.type === "text/plain") {
                resolve(e.target?.result as string);
                return;
            }
            reject(new Error("File is not text/plain"));
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    });

export default function useFileReader() {
    return { pdfToText, docxToText, textPlainToText }
}
