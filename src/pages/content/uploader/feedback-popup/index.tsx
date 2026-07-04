import { Button } from "@/components/ui/button";
import { MessageSquareHeartIcon } from "lucide-react";
import { FC } from "react";

type FeedbackPopupProps = {
    className?: string;
    menuMode?: boolean;
};

const FeedbackPopup: FC<FeedbackPopupProps> = ({ className, menuMode = false }) => {
    if (menuMode) {
        return (
            <Button
                variant="ghost"
                className="gpt:w-full gpt:justify-start gpt:gap-2 gpt:px-3 gpt:rounded-md hover:gpt:bg-gray-100 gpt:dark:hover:bg-gray-700 gpt:[&_svg]:size-4"
                onClick={() => { chrome.runtime.sendMessage({ type: "OPEN_FEEDBACK" }); }}
            >
                <MessageSquareHeartIcon /> Send Feedback
            </Button>
        )
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className={className ?? "hover:gpt:scale-115 active:gpt:scale-105 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"}
            onClick={() => {
                chrome.runtime.sendMessage({ type: "OPEN_FEEDBACK" });
            }}
            title={chrome.i18n.getMessage("feedback")}
            aria-label={chrome.i18n.getMessage("feedback")}
        >
            <MessageSquareHeartIcon />
        </Button>
    )
}

export default FeedbackPopup;
