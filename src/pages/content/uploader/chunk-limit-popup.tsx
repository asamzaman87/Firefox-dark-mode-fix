import { FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "../../../components/ui/dialog";
import {
  DialogDescription,
  DialogProps,
  DialogTitle,
} from "@radix-ui/react-dialog";
import { Button } from "../../../components/ui/button";

interface ChunkLimitPopupProps extends DialogProps {
  onClose: () => void;
}

const ChunkLimitPopup: FC<ChunkLimitPopupProps> = ({ open, onClose, ...props }) => {
  return (
    <Dialog open={open} onOpenChange={onClose} {...props}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[95vw] gpt:sm:w-[95vw] gpt:sm:max-w-[620px] gpt:md:w-[80vw] gpt:md:max-w-[750px] lg:gpt:w-[60vw] lg:gpt:max-w-[800px] xl:gpt:max-w-[900px] gpt:rounded-2xl"
      >
        <DialogHeader className="gpt:sr-only">
          <DialogTitle className="gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2">
            Download Limit
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">
            Free users have a download limit
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:w-full gpt:flex gpt:flex-col gpt:gap-6 gpt:justify-center gpt:items-center">
          <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:text-justify">
            <h1 className="gpt:text-xl gpt:font-medium gpt:text-center">
              🎁 This Download Is On Us! 🎁
            </h1>
            <p className="gpt:text-base gpt:text-muted-foreground gpt:text-center">
              Free users can normally download up to 5 minutes of audio. Since this is your first time exceeding that, enjoy a free bonus download! After this, the 5-minute limit applies.
            </p>
          </section>

          <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4 gpt:w-full">
            <Button
              variant={"ghost"}
              size={"lg"}
              className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
              onClick={onClose}
            >
              Got It
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChunkLimitPopup;

