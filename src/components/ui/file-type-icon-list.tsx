import { File, FileTextIcon, LetterTextIcon, Type } from "lucide-react";
import { FC, ReactNode } from "react";

interface FileTypeIconListProps {
    fileTypes: string[];
}

interface IconTextWrapperProps {
    tip: React.ReactNode;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const IconTextWrapper: FC<IconTextWrapperProps> = ({ tip, Icon }) => {
    return (
        <div className="flex items-center justify-center flex-col gap-1 rounded-full border border-gray-500 border-dashed size-20">
            <Icon className="size-7" />
            <p className="mx-auto text-sm font-medium text-center align-middle">{tip}</p>
        </div>
    );
};

const DocxIcon = () => (
    <IconTextWrapper
        tip="Word"
        Icon={() => <LetterTextIcon className="size-7" />}
    />
);

const PdfIcon = () => (
    <IconTextWrapper
        tip="PDF"
        Icon={() => <FileTextIcon className="size-7" />}
    />
)

const PlainTextIcon = () => (
    <IconTextWrapper
        tip="Text"
        Icon={() => <Type className="size-7" />} />
)

const fileTypeVsIconMap: Record<string, ReactNode> = {
    "application/pdf": <PdfIcon />,
    "application/msword": <DocxIcon />,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": <DocxIcon />,
    "text/plain": <PlainTextIcon />,
    "default": <File className="size-10" />
}

const FileTypeIconList: FC<FileTypeIconListProps> = ({ fileTypes }) => {
    if (!fileTypes.length) return <></>;

    return <div className="w-max flex justify-center items-center gap-4">
        {fileTypes.map(type => {
            if (!fileTypeVsIconMap[type]) return fileTypeVsIconMap["default"];
            return fileTypeVsIconMap[type];
        })}
    </div>
}

export default FileTypeIconList