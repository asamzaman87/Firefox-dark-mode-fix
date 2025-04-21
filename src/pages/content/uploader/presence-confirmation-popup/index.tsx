import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoaderCircleIcon } from "lucide-react";
import { FC } from "react";

interface PresenceConfirmationPopupProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  handleYes: () => void;
  handleNo: () => void;
  loading?: boolean;
}

const PresenceConfirmationPopup: FC<PresenceConfirmationPopupProps> = ({ open, setOpen, handleYes, handleNo, loading }) => {

  const onYes = () => {
    handleYes()
  }

  const onNo = () => {
    handleNo()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        closeButton={false}
        onInteractOutside={(e) => {
          e.preventDefault(); //prevents mask click close
        }}
        className="bg-gray-100 dark:bg-gray-800 border-none"
      >
        <DialogHeader>
          <DialogTitle className="text-center">
            {chrome.i18n.getMessage("presence_confirmation_title")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {chrome.i18n.getMessage("presence_confirmation_description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center gap-4 p-4">
          <div className="flex gap-4 justify-center">
            <Button disabled={loading} variant="ghost" size="sm" className="w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all" onClick={onYes}>
              {loading && <LoaderCircleIcon className="size-6 animate-spin" />} {chrome.i18n.getMessage("presence_confirmation_yes")}
            </Button>
            <Button disabled={loading} size="sm" onClick={onNo} variant={"ghost"} className="w-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
              {chrome.i18n.getMessage("presence_confirmation_no")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default PresenceConfirmationPopup;