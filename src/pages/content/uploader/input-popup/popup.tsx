import {
    Dialog, DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DialogProps, } from "@radix-ui/react-dialog";
import { Mic, Type } from "lucide-react";
import { FC } from "react";
import InputForm, { InputFormProps } from "./input-form";
import { usePremiumModal } from "../../../../context/premium-modal";
import { useSpeechMode } from "../../../../context/speech-mode";

type InputPopupProps = DialogProps & { onSubmit?: InputFormProps["onSubmit"]; disabled?: boolean };

const InputPopup: FC<InputPopupProps> = ({ disabled, onSubmit, ...props }) => {
    const {isTriggered, setOpen} = usePremiumModal();
    const {isTextToSpeech} = useSpeechMode();

    const headerText = chrome.i18n.getMessage(isTextToSpeech ? "type_or_paste_text" : "speak_to_transcribe");
    const description = chrome.i18n.getMessage(isTextToSpeech ? "type_or_paste_text_v2" : "speak_to_transcribe_v2");

    const triggerPremium = (
      e: React.MouseEvent<HTMLDivElement, MouseEvent>
    ) => {
      if (isTriggered) {
        setOpen(true);
        e.preventDefault();
      }
    };

    return (
        <Dialog {...props}>
            <DialogTrigger asChild disabled={disabled}>
                <div onClick={isTextToSpeech ? triggerPremium : undefined} className={cn("gpt:group gpt:relative gpt:grid gpt:size-full gpt:cursor-pointer gpt:place-items-center gpt:rounded-2xl gpt:border-2 gpt:border-dashed gpt:border-gray-500 gpt:dark:hover:border-gray-200 gpt:hover:border-gray-700 gpt:px-5 gpt:py-2.5 gpt:text-center gpt:transition gpt:hover:bg-gray-200 gpt:dark:hover:bg-gray-700",
                    "gpt:ring-offset-background gpt:focus-visible:outline-none gpt:focus-visible:ring-2 gpt:focus-visible:ring-ring gpt:focus-visible:ring-offset-2",)}>
                    <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 sm:px-5 gpt:cursor-pointer">
                        <div className="gpt:rounded-full gpt:border gpt:border-gray-500 gpt:border-dashed gpt:flex gpt:items-center gpt:justify-center gpt:size-20">
                            {isTextToSpeech ? (
                                <Type className="gpt:size-7" aria-hidden="true" />
                            ) : (
                                <Mic className="gpt:size-7" aria-hidden="true" />
                            )}
                        </div>
                        <div className="gpt:flex gpt:flex-col gpt:items-end gpt:justify-center gpt:gap-px">
                            <p className="gpt:font-medium gpt:text-center">
                                {headerText}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent
                onInteractOutside={(e) => {
                    e.preventDefault(); //prevents mask click close
                }}
                className="gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border-none gpt:min-w-[50dvw]"
            >
                <DialogHeader>
                    <DialogTitle className="gpt:text-center">{headerText}</DialogTitle>
                    <DialogDescription className="gpt:sr-only">{description}</DialogDescription>
                </DialogHeader>
                { isTextToSpeech ? <InputForm disabled={disabled} onSubmit={onSubmit} /> : null}
            </DialogContent>
        </Dialog>
    )
}

export default InputPopup;