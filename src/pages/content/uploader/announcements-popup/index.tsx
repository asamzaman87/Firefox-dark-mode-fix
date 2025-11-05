import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AccordionTrigger } from "@radix-ui/react-accordion";
import { ChevronDownCircleIcon, Megaphone, RefreshCwIcon } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import AnnouncementMessage from "./announcement-message";

interface Announcement {
  id: string;
  title: string;
  message: string;
  extension: string;
  important?: boolean;
  only_chrome?: boolean;
  created_on: Date;
  updated_on: Date;
}

const Announcements = () => {
  const [selectedAcc, setSelectedAcc] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [count, setCount] = useState<number>(0);
  const [open, setOpen] = useState<boolean>(false);
  const knownFallbackIdsRef = useRef<Set<string>>(new Set());
  
  const { toast } = useToast();
  
  const FALLBACK_ANNOUNCEMENTS: Announcement[] = [
    {
      id: "3",
      title: "Fix this Tip 2",
      message: "Fix this automatically downloads audio for you if you choose to listen to audio, make use of that as you wish by clicking on the cloud button at the top next to the title",
      extension: "your-extension-name",
      created_on: new Date("2025-05-11"),
      updated_on: new Date("2025-05-11"),
    },
    {
      id: "2",
      title: "Fix this Tip",
      message: "If you find yourself having issues, then click on the back button, upload your text, and try again.",
      extension: "your-extension-name",
      created_on: new Date("2025-05-10"),
      updated_on: new Date("2025-05-10"),
    },
    {
      id: "1",
      title: "Welcome to the Extension!",
      message: "Thanks for installing! Please be sure to leave me feedback if you'd like to request a new feature or fix an issue.",
      extension: "your-extension-name",
      created_on: new Date("2025-01-30"),
      updated_on: new Date("2025-01-30"),
    },
  ];

  const loadKnownFallbackIds = async () => {
    const result = await chrome.storage.local.get("knownFallbackAnnouncementIds");
    const storedIds = result.knownFallbackAnnouncementIds ?? [];
    knownFallbackIdsRef.current = new Set(storedIds);
  };

  const saveKnownFallbackIds = async () => {
    await chrome.storage.local.set({
      knownFallbackAnnouncementIds: Array.from(knownFallbackIdsRef.current),
    });
  };
  
  const getAnnouncements = async () => {
    try {
      await chrome.runtime.sendMessage({ type: "GET_ANNOUNCEMENTS" });
    } catch (error) {
      console.error("Failed to fetch announcements from API", error);
      // Fallback mechanism
      await loadKnownFallbackIds();
      const newFallbacks = FALLBACK_ANNOUNCEMENTS.filter(
        (a) => !knownFallbackIdsRef.current.has(a.id)
      );
      newFallbacks.forEach((a) => knownFallbackIdsRef.current.add(a.id));
      await saveKnownFallbackIds();

      setCount(newFallbacks.length);
      setSelectedAcc(FALLBACK_ANNOUNCEMENTS.map((item) => item.id));
      setAnnouncements(FALLBACK_ANNOUNCEMENTS);
    }
  };
  
  const handleAnnouncementClick = () => {
    chrome.runtime.sendMessage({ type: "ANNOUNCEMENTS_OPENED", count });
    getAnnouncements();
    setCount(0);
  };

  useMemo(() => {
    if (count > 0) {
      toast({
        description:
          "Hey there 👋 ! We've got some new announcements for you. Click the megaphone 📣 icon to check them out!",
        style: TOAST_STYLE_CONFIG_INFO,
      });
      if (open) handleAnnouncementClick();
    }
  }, [count]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleListener = async(message: {
      type: string;
      payload: Announcement[] | number;
    }) => {
      switch (message.type) {
        case "GET_BANNER": {
          const newAnnouncements = message.payload as Announcement[];
          if (newAnnouncements && newAnnouncements.length) {
            setSelectedAcc(newAnnouncements.map((item) => item.id));
            setAnnouncements(newAnnouncements);
          } else {
            // Fallback only if API response is empty
            await loadKnownFallbackIds();
            const newFallbacks = FALLBACK_ANNOUNCEMENTS.filter(
              (a) => !knownFallbackIdsRef.current.has(a.id)
            );
            newFallbacks.forEach((a) => knownFallbackIdsRef.current.add(a.id));
            await saveKnownFallbackIds();
            setCount(newFallbacks.length);
            setSelectedAcc(FALLBACK_ANNOUNCEMENTS.map((item) => item.id));
            setAnnouncements(FALLBACK_ANNOUNCEMENTS);
          }
          return;
        }
        case "GET_BANNER_COUNT": {
          setCount(message.payload as number);
          return;
        }
        default:
          break;
      }
    };
    chrome.runtime.onMessage.addListener(handleListener);
    setTimeout(() => getAnnouncements(), 500);

    return () => {
      chrome.runtime.onMessage.removeListener(handleListener);
      setAnnouncements([]);
      setCount(0);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="gpt:relative hover:gpt:scale-115 active:gpt:scale-105 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
          onClick={handleAnnouncementClick}
        >
          <Megaphone className="gpt:-rotate-12" />
          {count > 0 ? (
            <Badge className="gpt:text-white gpt:bg-red-600 gpt:dark:bg-red-500 gpt:absolute gpt:-top-1.5 gpt:left-1/2 gpt:rounded-full gpt:flex gpt:items-center gpt:justify-center">
              {count}
            </Badge>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault(); //prevents mask click close
        }}
        className="gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border-none gpt:min-w-[50dvw] gpt:max-h-[80dvh] gpt:w-screen gpt:overflow-hidden gpt:gap-4"
      >
        <DialogHeader>
          <DialogTitle className="gpt:flex gpt:items-center gpt:justify-center gpt:gap-2">
            Announcements
            <Button
              variant="ghost"
              size="icon"
              onClick={getAnnouncements}
              className="gpt:font-medium hover:gpt:scale-115 active:gpt:scale-105 active:gpt:rotate-180 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
            >
              <RefreshCwIcon />
            </Button>
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">
            Annoucement of new features and updates
          </DialogDescription>
        </DialogHeader>
        <div className="gpt:max-h-[50dvh] gpt:min-h-[50dvh] gpt:overflow-y-auto gpt:p-px">
          {announcements?.length ? (
            <Accordion
              type="multiple"
              className="gpt:size-full"
              onValueChange={setSelectedAcc}
              value={selectedAcc}
            >
              {announcements.map((item) => (
                <AccordionItem
                  value={item.id}
                  key={item.id}
                  className="gpt:p-2 gpt:border gpt:mb-2"
                >
                  <AccordionTrigger className="gpt:flex gpt:justify-between gpt:items-center gpt:w-full gpt:py-2">
                    <span className="gpt:inline-flex gpt:items-center gpt:flex-col gpt:gap-2">
                      <span className="gpt:w-full gpt:text-justify gpt:font-semibold gpt:max-w-[70dvw] gpt:truncate" title={item.title}>
                          {item.title}
                        </span>
                      <span className="gpt:text-gray-600 gpt:dark:text-gray-500 gpt:font-medium gpt:text-sm gpt:w-full gpt:text-start">
                        {new Date(item.created_on).toLocaleDateString()}
                      </span>
                    </span>
                    <span>
                      <ChevronDownCircleIcon
                        className={cn("gpt:size-5", {
                          "gpt:rotate-180": selectedAcc.includes(item.id),
                        })}
                      />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="gpt:font-medium gpt:leading-relaxed [&_a]:text-blue-600 [&_a]:underline">
                    <AnnouncementMessage message={item.message} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="gpt:size-full gpt:flex gpt:flex-col gpt:items-center gpt:justify-center gpt:gap-2 gpt:text-center">
              <span>
                <Megaphone className="gpt:size-16 gpt:text-gray-600 gpt:-rotate-12" />
              </span>
              <p className="gpt:text-gray-600 gpt:text-sm">No announcements found</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default memo(Announcements);
