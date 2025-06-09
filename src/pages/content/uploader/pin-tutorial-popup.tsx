/* eslint-disable react/no-unescaped-entities */
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "../../../components/ui/carousel";

type PinTutorialProps = DialogProps;

type TutorialStep = {
  title: string;
  description: string;
  imageUrl: string;
  altText: string;
};

const PinTutorialPopUp: FC<PinTutorialProps> = ({
  open,
  onOpenChange,
  ...props
}) => {
  const LOGO = chrome.runtime.getURL("logo-128.png");
  const tutorial = chrome.runtime.getURL("pin-step-3.png");
  const extensionName = "GPT Reader";

  const tutorialSteps: TutorialStep[] = [
    {
      title: "1. Click the Extensions Icon",
      description:
        "Look for the puzzle piece icon in your browser toolbar and click it.",
      imageUrl: tutorial,
      altText:
        "Browser toolbar with the extensions (puzzle piece) icon highlighted.",
    },
    {
      title: `2. Find "${extensionName} and Click the Pin Icon"`,
      description: `In the dropdown menu, find "${extensionName}" in your list of installed extensions and Click the Pin Icon`,
      imageUrl: tutorial,
      altText: `Extensions dropdown menu showing a list of extensions, with "${extensionName}" visible.`,
    },
    {
      title: "3. Extension Pinned!",
      description: `The "${extensionName}" icon will now appear directly on your browser toolbar for easy access.`,
      imageUrl: tutorial,
      altText: `Browser toolbar showing the "${extensionName}" icon successfully pinned.`,
    },
  ];

  const handlePinTutorialAcknowledged = (open: boolean) => {
    window.localStorage.setItem("gptr/pinTutorialAcknowledged", String(open));
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        closeButton={false}
        className="bg-gray-50 dark:bg-gray-800 border-none md:min-w-1/2 rounded-2xl"
      >
        <DialogHeader className={"sr-only"}>
          <DialogTitle className="inline-flex flex-col justify-center items-center gap-2">
            {chrome.i18n.getMessage("are_you_sure")}
          </DialogTitle>
          <DialogDescription className="sr-only">Description</DialogDescription>
        </DialogHeader>

        <div className="w-full flex flex-col gap-6 justify-center items-center">
          <section className="flex flex-col justify-center items-center gap-4 text-justify">
            <img src={LOGO} alt="GPT Reader Logo" className="size-12" />
            <h1 className="text-xl font-medium">Pin GPT Reader Extension</h1>
            <p className="dark:text-gray-200 text-gray-600 leading-loose">
              Follow these steps to pin our extension to your browser toolbar
              for quick and easy access.
            </p>
            <Carousel className="w-full">
              <CarouselContent>
                {tutorialSteps.map((step, index) => (
                  <CarouselItem
                    key={index}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="flex flex-col gap-4">
                      <p className="text-lg font-medium">{step.title}</p>
                      <div className="rounded-md overflow-hidden border border-muted aspect-[16/10] w-full max-w-lg mx-auto">
                        <img
                          src={step.imageUrl}
                          alt={step.altText}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="ml-2 sm:ml-8 dark:hover:bg-gray-600" />
              <CarouselNext className="mr-2 sm:mr-8 dark:hover:bg-gray-600" />
            </Carousel>
          </section>

          <footer className="flex items-end justify-center gap-4">
            <Button
              variant={"ghost"}
              className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
              onClick={() => handlePinTutorialAcknowledged(true)}
            >
              Got it!
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PinTutorialPopUp;
