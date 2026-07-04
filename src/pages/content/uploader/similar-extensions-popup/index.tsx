import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePremiumModal } from "@/context/premium-modal";
import {
  CURRENT_EXTENSION_ID,
  SIMILAR_EXTENSIONS,
  SimilarExtension,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Blocks, ExternalLink, Sparkles } from "lucide-react";
import { FC, useEffect, useMemo, useState } from "react";

// Pick the right store listing for the user's current browser.
const getListingUrl = (ext: SimilarExtension) => {
  const ua = navigator?.userAgent ?? "";
  if (ua.includes("Firefox")) return ext.firefox;
  if (ua.includes("Edg/")) return ext.edge || ext.chrome;
  return ext.chrome;
};

const SimilarExtensions: FC = () => {
  const [open, setOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const { isSubscribed } = usePremiumModal();

  const SEEN_KEY = "hasSeenSimilarExtensions";

  useEffect(() => {
    setIsNew(window.localStorage.getItem(SEEN_KEY) !== "true");
  }, []);

  // Auto-open on first launch; a short delay lets other startup effects settle.
  useEffect(() => {
    if (!isNew) return;
    const timer = setTimeout(() => setOpen(true), 1000);
    return () => clearTimeout(timer);
  }, [isNew]);

  const handleOpenChange = (nextOpen: boolean) => {
    // Mark as seen when the user actively closes the dialog.
    if (!nextOpen && isNew) {
      window.localStorage.setItem(SEEN_KEY, "true");
      setIsNew(false);
    }
    setOpen(nextOpen);
  };

  // Current extension first (with a "Current" tag), then the others.
  const ordered = useMemo(() => {
    const current = SIMILAR_EXTENSIONS.filter((e) => e.id === CURRENT_EXTENSION_ID);
    const others = SIMILAR_EXTENSIONS.filter((e) => e.id !== CURRENT_EXTENSION_ID);
    return [...current, ...others];
  }, []);

  const openListing = (ext: SimilarExtension) => {
    if (ext.id === CURRENT_EXTENSION_ID) return;
    chrome.runtime.sendMessage({ type: "OPEN_REVIEWS", url: getListingUrl(ext) });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="gpt:relative gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-5 gpt:hover:scale-105 gpt:active:scale-95 gpt:transition-all"
        >
          <Blocks /> Similar Extensions
          {isNew && (
            <span className="gpt:absolute gpt:-top-2 gpt:-right-2 gpt:bg-amber-500 gpt:text-white gpt:text-[9px] gpt:font-bold gpt:px-1.5 gpt:py-0.5 gpt:rounded-full gpt:leading-none gpt:shadow-sm gpt:border gpt:border-white gpt:dark:border-gray-900 gpt:pointer-events-none">
              NEW
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        className="gpt:bg-gray-100 gpt:dark:bg-gray-800 gpt:border-none gpt:text-gray-900 gpt:dark:text-gray-100 gpt:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="gpt:text-gray-900 gpt:dark:text-gray-100">
            Similar Extensions
          </DialogTitle>
          <DialogDescription className="gpt:text-gray-600 gpt:dark:text-gray-400">
            More free AI reader extensions from our team.
          </DialogDescription>
        </DialogHeader>

        {isSubscribed && (
          <div className="gpt:flex gpt:items-start gpt:gap-2 gpt:rounded-xl gpt:border gpt:border-amber-300 gpt:dark:border-amber-500/40 gpt:bg-amber-50 gpt:dark:bg-amber-500/10 gpt:p-3 gpt:text-sm gpt:text-amber-800 gpt:dark:text-amber-200">
            <Sparkles className="gpt:size-5 gpt:shrink-0 gpt:mt-0.5" />
            <p>
              As a premium member, your subscription also unlocks full premium
              access to all of these extensions — at no extra cost.
            </p>
          </div>
        )}

        <div className="gpt:flex gpt:flex-col gpt:gap-2 gpt:w-full">
          {ordered.map((ext) => {
            const isCurrent = ext.id === CURRENT_EXTENSION_ID;
            return (
              <button
                key={ext.id}
                type="button"
                disabled={isCurrent}
                onClick={() => openListing(ext)}
                className={cn(
                  "gpt:w-full gpt:flex gpt:items-center gpt:gap-3 gpt:rounded-xl gpt:border gpt:p-3 gpt:text-left gpt:transition-all",
                  "gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-900",
                  isCurrent
                    ? "gpt:cursor-default"
                    : "gpt:hover:bg-gray-200 gpt:dark:hover:bg-gray-700 gpt:hover:scale-[1.02] gpt:cursor-pointer"
                )}
              >
                <img
                  src={chrome.runtime.getURL(ext.icon)}
                  alt={`${ext.name} logo`}
                  className="gpt:size-10 gpt:rounded-lg gpt:shrink-0"
                />
                <div className="gpt:flex gpt:flex-col gpt:min-w-0 gpt:flex-1">
                  <span className="gpt:font-medium gpt:truncate">{ext.name}</span>
                </div>
                {isCurrent ? (
                  <span className="gpt:text-xs gpt:font-medium gpt:rounded-full gpt:px-2.5 gpt:py-1 gpt:bg-gray-200 gpt:dark:bg-gray-700 gpt:text-gray-700 gpt:dark:text-gray-200 gpt:shrink-0">
                    Current
                  </span>
                ) : (
                  <ExternalLink className="gpt:size-5 gpt:text-gray-500 gpt:dark:text-gray-400 gpt:shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimilarExtensions;
