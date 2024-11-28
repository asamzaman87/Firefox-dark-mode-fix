import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { DialogProps, } from "@radix-ui/react-dialog";
import { MessageSquareHeartIcon } from "lucide-react";
import { FC, useState } from "react";
import FeedbackForm, { FeedbackFormProps } from "./feeback-form";

type FeedbackPopupProps = DialogProps;

const FeedbackPopup: FC<FeedbackPopupProps> = ({...props }) => {
    const [open, setOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const onSubmit: FeedbackFormProps["onSubmit"] = (values)=>{
        setLoading(true)
        //ToDo: hit api endpoint
        console.log("FEEDBACK", values);
        setTimeout(() => {
            setOpen(false);
            setLoading(false)
        }, 5000);
    }
    
    return (
        <Dialog open={open} onOpenChange={setOpen} {...props}>
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
                <FeedbackForm loading={loading} onSubmit={onSubmit}/>
            </DialogContent>
        </Dialog>
    )
}

export default FeedbackPopup;