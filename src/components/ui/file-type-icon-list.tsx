import { File, FileTextIcon, LetterTextIcon, Type, MusicIcon, FileAudioIcon, Volume2Icon } from "lucide-react";
import { FC, ReactNode } from "react";
import { useSpeechMode } from "../../context/speech-mode";

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

const Mp3Icon = () => <IconTextWrapper tip="MP3" Icon={FileAudioIcon} />;

const WavIcon = () => <IconTextWrapper tip="WAV" Icon={Volume2Icon} />;

const WebmIcon = () => <IconTextWrapper tip="WEBM" Icon={MusicIcon} />;

const readerFileTypeVsIconMap: Record<string, ReactNode> = {
    "application/pdf": <PdfIcon />,
    "application/msword": <DocxIcon />,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": <DocxIcon />,
    "text/plain": <PlainTextIcon />,
    "default": <File className="gpt:size-10" />
}

const transcriberFileTypeVsIconMap: Record<string, ReactNode> = {
  mp3: <Mp3Icon />,
  wav: <WavIcon />,
  webm: <WebmIcon />,
  default: <IconTextWrapper tip="AUDIO" Icon={File} />,
};

const FileTypeIconList: FC<FileTypeIconListProps> = ({ fileTypes }) => {
    if (!fileTypes.length) return <></>;
    const {isTextToSpeech} = useSpeechMode();

    const finalFileTypeVsIconMap = isTextToSpeech ? readerFileTypeVsIconMap : transcriberFileTypeVsIconMap;

    return <div className="gpt:w-max gpt:flex gpt:justify-center gpt:items-center gpt:gap-4">
        {fileTypes.map(type => {
            if (!finalFileTypeVsIconMap[type]) return finalFileTypeVsIconMap["default"];
            return finalFileTypeVsIconMap[type];
        })}
    </div>
}

export default FileTypeIconList