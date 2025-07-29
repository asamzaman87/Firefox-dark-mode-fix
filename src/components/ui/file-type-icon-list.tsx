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
        <div className="gpt:flex gpt:items-center gpt:justify-center gpt:flex-col gpt:gap-1 gpt:rounded-full gpt:border gpt:border-gray-500 gpt:border-dashed gpt:size-20">
            <Icon className="gpt:size-7" />
            <p className="gpt:mx-auto gpt:text-sm gpt:font-medium gpt:text-center gpt:align-middle">{tip}</p>
        </div>
    );
};

const DocxIcon = () => (
    <IconTextWrapper
        tip="DOCX"
        Icon={() => <LetterTextIcon className="gpt:size-7" />}
    />
);

const PdfIcon = () => (
    <IconTextWrapper
        tip="PDF"
        Icon={() => <FileTextIcon className="gpt:size-7" />}
    />
)

const PlainTextIcon = () => (
    <IconTextWrapper
        tip="TXT"
        Icon={() => <Type className="gpt:size-7" />} />
)

const fileTypeVsIconMap: Record<string, ReactNode> = {
    "application/pdf": <PdfIcon />,
    "application/msword": <DocxIcon />,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": <DocxIcon />,
    "text/plain": <PlainTextIcon />,
    "default": <File className="gpt:size-10" />
}

const FileTypeIconList: FC<FileTypeIconListProps> = ({ fileTypes }) => {
    if (!fileTypes.length) return <></>;

    return <div className="gpt:w-max gpt:flex gpt:justify-center gpt:items-center gpt:gap-4">
        {fileTypes.map(type => {
            if (!fileTypeVsIconMap[type]) return fileTypeVsIconMap["default"];
            return fileTypeVsIconMap[type];
        })}
    </div>
}

export default FileTypeIconList