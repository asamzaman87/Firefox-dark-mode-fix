import {
    Dialog, DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { DialogProps, } from "@radix-ui/react-dialog";
import { Type } from "lucide-react";
import { FC } from "react";
import InputForm, { InputFormProps } from "./input-form";
import { cn } from "@/lib/utils";

type InputPopupProps = DialogProps & { onSubmit: InputFormProps["onSubmit"]; disabled?: boolean };

const InputPopup: FC<InputPopupProps> = ({ disabled, onSubmit, ...props }) => {
    return (
        <Dialog {...props}>
            <DialogTrigger asChild disabled={disabled}>
                <div className={cn("group relative grid size-full cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-muted-foreground/25 px-5 py-2.5 text-center transition hover:bg-muted/25",
                    "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",)}>
                    <div className="flex flex-col items-center justify-center gap-4 sm:px-5 cursor-pointer">
                        <div className="rounded-full border border-dashed p-3">
                            <Type
                                className="size-7 text-muted-foreground"
                                aria-hidden="true"
                            />
                        </div>
                        <div className="flex flex-col gap-px">
                            <p className="font-medium text-muted-foreground">
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
                <DialogHeader className="sr-only">
                    <DialogTitle>Type Or Paste Text</DialogTitle>
                    <DialogDescription>Paste or type your text</DialogDescription>
                </DialogHeader>
                <InputForm onSubmit={onSubmit} />
            </DialogContent>
        </Dialog>
    )
}

export default InputPopup;