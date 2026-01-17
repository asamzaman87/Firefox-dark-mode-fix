import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  DialogDescription,
  DialogProps,
  DialogTitle,
} from "@radix-ui/react-dialog";
import { FC, useState, useEffect } from "react";
import Ratings from "@/components/ui/ratings";
import { Star, Heart, Sparkles, X } from "lucide-react";
import useConfetti from "@/hooks/use-confetti";
import { REVIEWS_CHROME, REVIEWS_FIREFOX } from "@/lib/constants";
import { detectBrowser } from "@/lib/utils";

interface FirstChunkRatingPopupProps extends DialogProps {
  onClose: () => void;
  isInline?: boolean; // For listening view - render inline instead of as dialog
  onRatingSubmit?: (rating: number) => void;
  onInteractionStart?: () => void; // Called when user clicks "Rate Now" - prevents auto-close
}

const FirstChunkRatingPopup: FC<FirstChunkRatingPopupProps> = ({ 
  open, 
  onClose, 
  isInline = false,
  onRatingSubmit,
  onInteractionStart,
  ...props 
}) => {
  const [rating, setRating] = useState<number>(0);
  const [showRatingInput, setShowRatingInput] = useState<boolean>(false);
  const [isRating5Stars, setIsRating5Stars] = useState<boolean>(false);
  const confetti = useConfetti();
  const isChrome = detectBrowser() === "chrome";

  const handleRateNow = () => {
    setShowRatingInput(true);
    onInteractionStart?.(); // Notify parent that user has interacted - prevent auto-close
  };

  const handleRatingChange = (value: number) => {
    setRating(value);
  };

  const handleSubmitRating = () => {
    if (rating === 0) return; // Don't submit if no rating selected
    
    if (rating === 5) {
      confetti();
      setIsRating5Stars(true);
      onRatingSubmit?.(rating);
    } else {
      // For 1-4 stars, close immediately after submitting
      onRatingSubmit?.(rating);
      // Close immediately for < 5 stars
      onClose();
    }
  };

  const handleStoreRedirection = () => {
    const url = isChrome ? REVIEWS_CHROME : REVIEWS_FIREFOX;
    // Set flag to prevent popup from showing again
    localStorage.setItem("gptr/firstChunkRated", "true");
    chrome.runtime.sendMessage({ type: "OPEN_REVIEWS", url }).finally(() => {
      setIsRating5Stars(false);
      onClose();
    });
  };

  const handleClose = () => {
    setRating(0);
    setShowRatingInput(false);
    setIsRating5Stars(false);
    onClose();
  };

  const content = (
    <div className="gpt:w-full gpt:flex gpt:flex-col gpt:gap-6 gpt:justify-center gpt:items-center gpt:min-h-full">
      {!showRatingInput && !isRating5Stars ? (
        <>
          <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-2">
            <Sparkles className="gpt:size-12 gpt:text-yellow-500 gpt:dark:text-yellow-400" />
          </div>
          <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:text-justify">
            <h1 className="gpt:text-xl gpt:font-medium gpt:text-center">
              Please rate the extension highly as it helps!
            </h1>
            <p className="gpt:text-base gpt:text-muted-foreground gpt:text-center">
              Your feedback helps us improve and reach more users.
            </p>
          </section>
          <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4 gpt:w-full">
            <Button
              variant={"ghost"}
              size={"lg"}
              className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
              onClick={handleRateNow}
            >
              Rate Now
            </Button>
          </footer>
        </>
      ) : isRating5Stars ? (
        <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 gpt:w-full gpt:relative gpt:py-6">
          {/* Close button for 5-star thank you view - circular border like voice selector, 1.5x bigger */}
          <button
            onClick={handleClose}
            className="gpt:absolute gpt:top-0 gpt:right-0 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all"
            aria-label="Close"
          >
            <X className="gpt:w-[36px] gpt:h-[36px] gpt:p-2" />
          </button>
          <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-2 gpt:w-full">
            <Heart className="gpt:size-20 gpt:animate-heartbeat gpt:fill-red-700 gpt:stroke-red-700" />
            <p className="gpt:text-center gpt:font-medium">Thank you!</p>
            <p className="gpt:text-center gpt:text-gray-500 gpt:dark:text-gray-400 gpt:text-wrap">
              We appreciate your support! Would you like to leave a review in the store?
            </p>
          </div>
          <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4 gpt:w-full">
            <Button
              variant={"ghost"}
              size={"lg"}
              className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
              onClick={handleStoreRedirection}
            >
              Review in Store
            </Button>
          </footer>
        </div>
      ) : (
        <div className="gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-4 gpt:w-full gpt:relative gpt:pt-12 gpt:pb-6">
          {/* Close button for stars view - circular border like confetti popup, 1.5x bigger, more space at top */}
          <button
            onClick={handleClose}
            className="gpt:absolute gpt:top-0 gpt:right-0 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:hover:scale-115 gpt:active:scale-105 gpt:transition-all"
            aria-label="Close"
          >
            <X className="gpt:w-[36px] gpt:h-[36px] gpt:p-2" />
          </button>
          <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:text-justify">
            <h1 className="gpt:text-xl gpt:font-medium gpt:text-center">
              How would you rate GPT Reader?
            </h1>
          </section>
          <div className="gpt:w-full gpt:flex gpt:flex-col gpt:justify-center gpt:items-center">
            <Ratings 
              size={40} 
              variant="yellow" 
              Icon={<Star />} 
              asInput 
              value={rating} 
              onValueChange={handleRatingChange} 
            />
          </div>
          <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4 gpt:w-full">
            <Button
              variant={"ghost"}
              size={"lg"}
              className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
              onClick={handleSubmitRating}
              disabled={rating === 0}
            >
              Submit
            </Button>
          </footer>
        </div>
      )}
    </div>
  );

  if (isInline) {
    // For listening view and download view - render as inline component (no dialog wrapper)
    if (!open) return null;
    return (
      <div className="gpt:w-full gpt:min-h-[300px] gpt:flex gpt:items-center gpt:justify-center gpt:bg-white gpt:dark:bg-black gpt:rounded gpt:drop-shadow gpt:p-10 gpt:border gpt:border-gray-800 gpt:dark:border-white">
        {content}
      </div>
    );
  }

  // For download view - render as Dialog with reduced overlay opacity and bottom positioning
  return (
    <Dialog open={open} onOpenChange={handleClose} {...props}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[95vw] gpt:sm:w-[95vw] gpt:sm:max-w-[620px] gpt:md:w-[80vw] gpt:md:max-w-[750px] lg:gpt:w-[60vw] lg:gpt:max-w-[800px] xl:gpt:max-w-[900px] gpt:rounded-2xl gpt:top-auto gpt:bottom-8 gpt:translate-y-0"
      >
        <DialogHeader className="gpt:sr-only">
          <DialogTitle className="gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2">
            Rate GPT Reader
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">
            Please rate the extension
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default FirstChunkRatingPopup;
