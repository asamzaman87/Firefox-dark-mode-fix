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

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent
      closeButton={false}
      onInteractOutside={(e) => {
        e.preventDefault(); //prevents mask click close
      }}
      className="bg-gray-100 dark:bg-gray-800 border-none min-w-[50dvw]"
    >
      <DialogHeader>
        <DialogTitle className="text-center">Are you still here?</DialogTitle>
        <DialogDescription className="sr-only">Are you still here?</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-center text-gray-500 dark:text-gray-400">
          You have been inactive for a while. Do you want to continue using GPT Reader?
        </p>
        <div className="flex gap-4 justify-center">
          <Button disabled={loading} variant="outline" size="sm" className="w-full" onClick={onYes}>
            {loading && <LoaderCircleIcon className="size-6 animate-spin" />} Yes, I want to continue listening
          </Button>
          <Button disabled={loading} variant="outline" size="sm" className="w-full" onClick={onNo}>
            No, I am done listening
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
};

export default PresenceConfirmationPopup;