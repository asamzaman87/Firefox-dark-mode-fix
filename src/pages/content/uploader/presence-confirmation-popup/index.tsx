import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoaderCircleIcon } from "lucide-react";
import { FC, memo } from "react";

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
        className="gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border-none"
      >
        <DialogHeader>
          <DialogTitle className="gpt:text-center">
            {chrome.i18n.getMessage("presence_confirmation_title")}
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">
            {chrome.i18n.getMessage("presence_confirmation_description")}
          </DialogDescription>
        </DialogHeader>
        <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 gpt:p-4">
          <div className="gpt:flex gpt:gap-4 gpt:justify-center">
            <Button disabled={loading} variant="ghost" size="sm" className="gpt:w-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all" onClick={onYes}>
              {loading && <LoaderCircleIcon className="gpt:size-6 gpt:animate-spin" />} {chrome.i18n.getMessage("presence_confirmation_yes")}
            </Button>
            <Button disabled={loading} size="sm" onClick={onNo} variant={"ghost"} className="gpt:w-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">
              {chrome.i18n.getMessage("presence_confirmation_no")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default memo(PresenceConfirmationPopup);