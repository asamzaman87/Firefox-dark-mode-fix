import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogProps } from "@radix-ui/react-dialog";
import VoiceSelector, { Voice } from "../voice-selector";
import { FC } from "react";
import { Button } from "@/components/ui/button";

type VoiceSelectPopupProps = DialogProps & {
  voices: Voice;
  setVoices: (voice: string) => void;
  isVoiceLoading: boolean;
  onClose: () => void;
  onVoiceSelect:()=>void
};
const VoiceSelectPopup: FC<VoiceSelectPopupProps> = ({
  voices,
  setVoices,
  isVoiceLoading,
  onClose,
  onVoiceSelect,
  ...props
}) => {
  return (
    <Dialog {...props} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault(); //prevents mask click close
        }}
        className="gpt:bg-gray-100 dark:bg-gray-800 gpt:border-none gpt:min-w-[20dvw] gpt:rounded-lg"
      >
        <DialogHeader>
          <DialogTitle>Select a Voice to Read Your Web Content</DialogTitle>
        </DialogHeader>
        <div className="gpt:flex gpt:justify-center gpt:flex-col gpt:items-center gpt:gap-3">
          <VoiceSelector
            voice={voices}
            setVoices={setVoices}
            disabled={isVoiceLoading}
            loading={isVoiceLoading}
          />
          <Button disabled={false} onClick={onVoiceSelect} type="submit" variant={"ghost"} className="gpt:border gpt:border-gray-200 dark:border-gray-700 gpt:bg-gray-50 dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"> 
            Confirm Voice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
export default VoiceSelectPopup;
