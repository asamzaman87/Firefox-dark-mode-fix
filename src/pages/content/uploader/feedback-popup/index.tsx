import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import useConfetti from "@/hooks/use-confetti";
import { useToast } from "@/hooks/use-toast";
import { FEEDBACK_ENDPOINT, REVIEWS_CHROME, REVIEWS_FIREFOX, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { detectBrowser, secureFetch } from "@/lib/utils";
import { DialogProps, } from "@radix-ui/react-dialog";
import { Heart, MessageSquareHeartIcon } from "lucide-react";
import { FC, useState } from "react";
import FeedbackForm, { FeedbackFormProps } from "./feeback-form";

type FeedbackPopupProps = DialogProps;

const isChrome = detectBrowser() === "chrome";

const FeedbackPopup: FC<FeedbackPopupProps> = ({ ...props }) => {
    const [open, setOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [isRating5Stars, setIsRating5Stars] = useState<boolean>(false);

    const { toast } = useToast();
    const confetti = useConfetti();

    const onSubmit: FeedbackFormProps["onSubmit"] = async (values) => {
        setLoading(true)
        const browser = detectBrowser();
        await secureFetch(FEEDBACK_ENDPOINT, {
            method: "POST",
            body: JSON.stringify({
                feedback: `Rating: ${values.rating} \n Comment: ${values.comments}`,
                email: values.email || null,
                browser,
                extension: "GPT-Reader",
            }),
        }).then(() => {
            if (values.rating === 5) {
                confetti();
                setIsRating5Stars(true);
                return 
            }
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
        const isFirefox = detectBrowser() === "firefox";
        if (isFirefox && open) {
            return chrome.runtime.sendMessage({ type: "OPEN_FEEDBACK" });
        }
        setOpen(open);
        setIsRating5Stars(false);
    }

    const onStoreRedirection = () => {
        const url = isChrome ? REVIEWS_CHROME : REVIEWS_FIREFOX;
        chrome.runtime.sendMessage({ type: "OPEN_REVIEWS", url }).finally(() => {
            setIsRating5Stars(false);
            setOpen(false);
        });

    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange} {...props}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:scale-115 active:scale-105  rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
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
                    <DialogTitle>{chrome.i18n.getMessage("feedback")}</DialogTitle>
                    <DialogDescription className="sr-only">{chrome.i18n.getMessage("type_or_paste_text_v2")}</DialogDescription>
                </DialogHeader>
                {isRating5Stars ?
                <div className="flex flex-col items-center justify-center gap-4 w-full">
                    <div className="flex flex-col items-center justify-center gap-2 w-full">
                        <Heart className="size-20 animate-heartbeat fill-red-700 stroke-red-700" />
                        <p className="text-center font-medium">{chrome.i18n.getMessage("feedback_thanks")}</p>
                        <p className="text-center text-gray-500 dark:text-gray-400 text-wrap">
                            {chrome.i18n.getMessage("five_stars")}
                        </p>
                    </div>
                        <DialogFooter className="w-full items-center justify-center flex-wrap">
                            <Button onClick={onStoreRedirection} variant="outline" className="cursor-pointer border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
                                {chrome.i18n.getMessage("store_redirect")}
                            </Button>
                        </DialogFooter>
                </div>
                    : <FeedbackForm loading={loading} onSubmit={onSubmit} />
                }
            </DialogContent>
        </Dialog>
    )
}

export default FeedbackPopup;
