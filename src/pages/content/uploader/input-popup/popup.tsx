import {
    Dialog, DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DialogProps, } from "@radix-ui/react-dialog";
import { Type } from "lucide-react";
import { FC } from "react";
import InputForm, { InputFormProps } from "./input-form";

type InputPopupProps = DialogProps & { onSubmit: InputFormProps["onSubmit"]; disabled?: boolean };

const InputPopup: FC<InputPopupProps> = ({ disabled, onSubmit, ...props }) => {
    return (
        <Dialog {...props}>
            <DialogTrigger asChild disabled={disabled}>
                <div className={cn("group relative grid size-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-gray-500 dark:hover:border-gray-200 hover:border-gray-700 px-5 py-2.5 text-center transition hover:bg-gray-200 dark:hover:bg-gray-700",
                    "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",)}>
                    <div className="flex flex-col items-center justify-center gap-4 sm:px-5 cursor-pointer">
                        <div className="rounded-full border border-gray-500 border-dashed flex items-center justify-center size-20">
                            <Type
                                className="size-7"
                                aria-hidden="true"
                            />
                        </div>
                        <div className="flex flex-col items-end justify-center gap-px">
                            <p className="font-medium text-center">
                                Type or Paste Text
                            </p>
                        </div>
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent
                onInteractOutside={(e) => {
                    e.preventDefault(); //prevents mask click close
                }}
                className="bg-gray-100 dark:bg-gray-800 border-none min-w-[50dvw]"
            >
                <DialogHeader>
                    <DialogTitle className="text-center">Type Or Paste Text</DialogTitle>
                    <DialogDescription className="sr-only">Paste or type your text</DialogDescription>
                </DialogHeader>
                <InputForm disabled={disabled} onSubmit={onSubmit} />
            </DialogContent>
        </Dialog>
    )
}

export default InputPopup;