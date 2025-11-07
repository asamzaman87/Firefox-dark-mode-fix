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
        "For quick access to Fix this & Transcriber, we recommend pinning the extension",
      description: isFirefox
        ? "To pin the extension, click on puzzle icon on your toolbar, then find the Fix this & Transcriber extension and click on the settings icon and then select the pin option"
        : "To pin the extension, click on puzzle icon on your toolbar, then find the Fix this & Transcriber extension and click on the pin icon next to it",
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
        className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[95vw] gpt:sm:w-[95vw] gpt:sm:max-w-[620px] gpt:md:w-[80vw] gpt:md:max-w-[750px] lg:gpt:w-[60vw] lg:gpt:max-w-[800px] xl:gpt:max-w-[900px] gpt:rounded-2xl"
      >
        <DialogHeader className={"gpt:sr-only"}>
          <DialogTitle className="gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2">
            {chrome.i18n.getMessage("are_you_sure")}
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">Description</DialogDescription>
        </DialogHeader>

        <div className="gpt:w-full gpt:flex gpt:flex-col gpt:gap-6 gpt:justify-center gpt:items-center">
          <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:text-justify">
            <img src={LOGO} alt="Fix this Logo" className="gpt:size-12" />
            <h1 className="gpt:text-xl gpt:font-medium">Important Information</h1>
            <Carousel className="gpt:w-full">
              <CarouselContent>
                {tutorialSteps.map((step, index) => (
                  <CarouselItem
                    key={index}
                    className="gpt:flex gpt:flex-col gpt:items-center gpt:text-center"
                  >
                    <div className="gpt:flex gpt:flex-col gpt:gap-4">
                      <p className="gpt:text-lg gpt:dark:text-gray-200 gpt:text-gray-600 gpt:leading-loose">
                        {step.title}
                      </p>
                      <div className="gpt:rounded-md gpt:overflow-hidden gpt:border gpt:border-muted gpt:aspect-[16/10] gpt:w-full gpt:max-w-lg gpt:mx-auto">
                        <img
                          src={step.imageUrl}
                          alt={step.altText}
                          className="gpt:w-full gpt:h-full gpt:object-contain"
                        />
                      </div>
                      {step.description ? (
                        <p className="gpt:text-sm gpt:text-muted-foreground">
                          {step.description}
                        </p>
                      ) : null}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="gpt:ml-8 gpt:dark:hover:bg-gray-600" />
              <CarouselNext className="gpt:mr-8 gpt:dark:hover:bg-gray-600" />
            </Carousel>
          </section>

          <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4">
            <Button
              variant={"ghost"}
              size={"lg"}
              className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
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
