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
import { BACKEND_URI, REVIEWS_CHROME, REVIEWS_FIREFOX, TOAST_STYLE_CONFIG } from "@/lib/constants";
import { detectBrowser, secureFetch } from "@/lib/utils";
import { DialogProps, } from "@radix-ui/react-dialog";
import { Heart, MessageSquareHeartIcon } from "lucide-react";
import { FC, useState } from "react";
import FeedbackForm, { FeedbackFormProps } from "./feeback-form";
import { useSpeechMode } from "../../../../context/speech-mode";

type FeedbackPopupProps = DialogProps;

const isChrome = detectBrowser() === "chrome";

const FeedbackPopup: FC<FeedbackPopupProps> = ({ ...props }) => {
    const [open, setOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [isRating5Stars, setIsRating5Stars] = useState<boolean>(false);
    const {isTextToSpeech} = useSpeechMode();

    const { toast } = useToast();
    const confetti = useConfetti();

    const onSubmit: FeedbackFormProps["onSubmit"] = async (values) => {
        setLoading(true)
        const browser = detectBrowser();
        await secureFetch(`${BACKEND_URI}/feedbacks/gpt-feedback`, {
            method: "POST",
            body: JSON.stringify({
                feedback: `Rating: ${values.rating} \n Comment: ${values.comments}`,
                email: values.email || null,
                browser,
                extension: isTextToSpeech ? "fix-this" : "Fix this",
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
            setOpen(false);
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
                <Button variant="ghost" size="icon" className="hover:gpt:scale-115 active:gpt:scale-105 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">
                    <MessageSquareHeartIcon />
                </Button>
            </DialogTrigger>
            <DialogContent
                onInteractOutside={(e) => {
                    e.preventDefault(); //prevents mask click close
                }}
                className="gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border-none gpt:min-w-[50dvw]"
            >
                <DialogHeader className="gpt:sr-only">
                    <DialogTitle>{chrome.i18n.getMessage("feedback")}</DialogTitle>
                    <DialogDescription className="gpt:sr-only">{chrome.i18n.getMessage("type_or_paste_text_v2")}</DialogDescription>
                </DialogHeader>
                {isRating5Stars ?
                <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 gpt:w-full">
                    <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-2 gpt:w-full">
                        <Heart className="gpt:size-20 gpt:animate-heartbeat gpt:fill-red-700 gpt:stroke-red-700" />
                        <p className="gpt:text-center gpt:font-medium">{chrome.i18n.getMessage("feedback_thanks")}</p>
                        <p className="gpt:text-center gpt:text-gray-500 gpt:dark:text-gray-400 gpt:text-wrap">
                            {chrome.i18n.getMessage("five_stars")}
                        </p>
                    </div>
                        <DialogFooter className="gpt:w-full gpt:items-center gpt:justify-center gpt:flex-wrap">
                            <Button onClick={onStoreRedirection} variant="outline" className="gpt:cursor-pointer gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">
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
