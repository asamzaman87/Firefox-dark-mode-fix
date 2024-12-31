import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FEEDBACK_ENDPOINT, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { detectBrowser } from "@/lib/utils";
import { DialogProps, } from "@radix-ui/react-dialog";
import { MessageSquareHeartIcon } from "lucide-react";
import { FC, useState } from "react";
import FeedbackForm, { FeedbackFormProps } from "./feeback-form";

type FeedbackPopupProps = DialogProps;

const FeedbackPopup: FC<FeedbackPopupProps> = ({ ...props }) => {
    const [open, setOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const { toast } = useToast();

    const onSubmit: FeedbackFormProps["onSubmit"] = async (values) => {
        setLoading(true)
        const browser = detectBrowser();
        //ToDo: to handle in popup https://developer.chrome.com/docs/extensions/reference/manifest/key after deployment
        await fetch(FEEDBACK_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${window.localStorage.getItem("gptr/token")}`,
            },
            body: JSON.stringify({
                feedback: `Rating: ${values.rating} \n Comment: ${values.comments}`,
                browser,
                extension: "GPT-Reader",
            }),
        }).then(() => {
            setOpen(false);
        }).catch((e) => {
            const error = e as Error
            toast({ description: error.message, style: TOAST_STYLE_CONFIG });
            chrome.runtime.sendMessage({ type: "OPEN_FEEDBACK" });
        }).finally(() => {
            setLoading(false);
        });
    }

    const onOpenChange = (open: boolean) => {
        if(detectBrowser()==="firefox" && open){            
          return chrome.runtime.sendMessage({ type: "OPEN_FEEDBACK" });
        }
        setOpen(open);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} {...props}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:scale-110  rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
                    <MessageSquareHeartIcon />
                </Button>
            </DialogTrigger>
            <DialogContent
                onInteractOutside={(e) => {
                    e.preventDefault(); //prevents mask click close
                }}
                className="bg-gray-100 dark:bg-gray-800 border-none min-w-[50dvw]"
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>Feedback</DialogTitle>
                    <DialogDescription className="sr-only">Paste or type your text</DialogDescription>
                </DialogHeader>
                <FeedbackForm loading={loading} onSubmit={onSubmit} />
            </DialogContent>
        </Dialog>
    )
}

export default FeedbackPopup;