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
import { detectBrowser } from "../../../lib/utils";

interface PinTutorialProps extends DialogProps {
  onClose: (value: boolean) => void;
}

type TutorialStep = {
  title: string;
  description: string;
  imageUrl: string;
  altText: string;
};

const PinTutorialPopUp: FC<PinTutorialProps> = ({
  open,
  onClose,
  ...props
}) => {
  const LOGO = chrome.runtime.getURL("logo-128.png");
  const CHROME_PIN = chrome.runtime.getURL("chrome-pin.png");
  const FIREFOX_PIN = chrome.runtime.getURL("firefox-pin.png");
  const guideExtImage = chrome.runtime.getURL("extension-guide.png");
  const isFirefox = detectBrowser() === "firefox";

  const tutorialSteps: TutorialStep[] = [
    {
      title:
        "For quick access to GPT Reader, we recommend pinning the extension",
      description: isFirefox
        ? "To pin the extension, click on puzzle icon on your toolbar, then find the GPT Reader extension and click on the settings icon and then select the pin option"
        : "To pin the extension, click on puzzle icon on your toolbar, then find the GPT Reader extension and click on the pin icon next to it",
      imageUrl: isFirefox ? FIREFOX_PIN : CHROME_PIN,
      altText: "Pin Extension Image",
    },
    {
      title: "Here is information on the extension icons",
      description: "",
      imageUrl: guideExtImage,
      altText: "Guide Image for extension",
    },
  ];

  const handlePinTutorialAcknowledged = (open: boolean) => {
    window.localStorage.setItem("gptr/pinTutorialAcknowledged", String(open));
    onClose?.(false);
  };

  const onOpenChange = (open: boolean) => {
    if(!open) {
      handlePinTutorialAcknowledged(!open);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} {...props}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        // closeButton={false}
        className="bg-gray-50 dark:bg-gray-800 border-none w-[95vw] max-w-[95vw] sm:w-[95vw] sm:max-w-[620px] md:w-[80vw] md:max-w-[750px] lg:w-[60vw] lg:max-w-[800px] xl:max-w-[900px] rounded-2xl"
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
            <h1 className="text-xl font-medium">Important Information</h1>
            <Carousel className="w-full">
              <CarouselContent>
                {tutorialSteps.map((step, index) => (
                  <CarouselItem
                    key={index}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="flex flex-col gap-4">
                      <p className="text-lg dark:text-gray-200 text-gray-600 leading-loose">
                        {step.title}
                      </p>
                      <div className="rounded-md overflow-hidden border border-muted aspect-[16/10] w-full max-w-lg mx-auto">
                        <img
                          src={step.imageUrl}
                          alt={step.altText}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      {step.description ? (
                        <p className="text-sm text-muted-foreground">
                          {step.description}
                        </p>
                      ) : null}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="ml-8 dark:hover:bg-gray-600" />
              <CarouselNext className="mr-8 dark:hover:bg-gray-600" />
            </Carousel>
          </section>

          <footer className="flex items-end justify-center gap-4">
            <Button
              variant={"ghost"}
              size={"lg"}
              className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
              onClick={() => handlePinTutorialAcknowledged(true)}
            >
              Okay
            </Button>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PinTutorialPopUp;
