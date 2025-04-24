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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { AccordionTrigger } from "@radix-ui/react-accordion";
import { ChevronDownCircleIcon, Megaphone, RefreshCwIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import AnnouncementMessage from "./announcement-message";

interface Announcement {
  id: string;
  title: string;
  message: string;
  extension: string;
  created_on: Date;
  updated_on: Date;
}

const Announcements = () => {
  const [selectedAcc, setSelectedAcc] = useState<string>();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [count, setCount] = useState<number>(0);
  const [open, setOpen] = useState<boolean>(false);
  
  const { toast } = useToast();
  

  const getAnnouncements = async () => {
    await chrome.runtime.sendMessage({ type: "GET_ANNOUNCEMENTS" });
  };

  const handleAnnouncementClick = () => {
    chrome.runtime.sendMessage({ type: "ANNOUNCEMENTS_OPENED", count });
    setCount(0);
  };

  useMemo(() => {
    if (count > 0) {
      toast({
        description:
          "Hey there 👋 ! We've got some fresh announcements. Click the megaphone 📣 icon to check them out!",
        style: TOAST_STYLE_CONFIG_INFO,
      });
      getAnnouncements();
      if (open) handleAnnouncementClick();
    }
  }, [count]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleListener = (message: {
      type: string;
      payload: Announcement[] | number;
    }) => {
      switch (message.type) {
        case "GET_BANNER":
          setAnnouncements(message.payload as Announcement[]);
          return;
        case "GET_BANNER_COUNT":
          setCount(message.payload as number);
          return;
        default:
          break;
      }
    };
    chrome.runtime.onMessage.addListener(handleListener);
    getAnnouncements();

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
          className="relative hover:scale-115 active:scale-105  rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
          onClick={handleAnnouncementClick}
        >
          <Megaphone className="-rotate-12" />
          {count > 0 ? (
            <Badge className="text-white bg-red-600 dark:bg-red-500 absolute -top-1.5 left-1/2 rounded-full flex items-center justify-center">
              {count}
            </Badge>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault(); //prevents mask click close
        }}
        className="bg-gray-100 dark:bg-gray-800 border-none min-w-[50dvw] max-h-[80dvh] w-screen overflow-hidden gap-4"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2">
            Announcements
            <Button
              variant="ghost"
              size="icon"
              onClick={getAnnouncements}
              className="font-medium hover:scale-115 active:scale-105 active:rotate-180 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all"
            >
              <RefreshCwIcon />
            </Button>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Annoucement of new features and updates
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50dvh] min-h-[50dvh] overflow-y-auto p-px">
          {announcements?.length ? (
            <Accordion
              type="single"
              collapsible
              className="size-full"
              onValueChange={setSelectedAcc}
            >
              {announcements.map((item) => (
                <AccordionItem
                  value={item.id}
                  key={item.id}
                  className="p-2 border mb-2"
                >
                  <AccordionTrigger className="flex justify-between items-center w-full py-2">
                    <span className="inline-flex items-center flex-col gap-2">
                      <span className="text-justify font-semibold max-w-[70dvw] truncate" title={item.title}>
                          {item.title}
                        </span>
                      <span className="text-gray-600 dark:text-gray-500 font-medium text-sm w-full text-start">
                        {new Date(item.created_on).toLocaleDateString()}
                      </span>
                    </span>
                    <span>
                      <ChevronDownCircleIcon
                        className={cn("size-5", {
                          "rotate-180": selectedAcc === item.id,
                        })}
                      />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="font-medium leading-relaxed">
                    <AnnouncementMessage message={item.message} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="size-full flex flex-col items-center justify-center gap-2 text-center">
              <span>
                <Megaphone className="size-16 text-gray-600 -rotate-12" />
              </span>
              <p className="text-gray-600 text-sm">No announcements found</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default memo(Announcements);
