import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { cancelSubscription, detectBrowser, getStoredValue } from "@/lib/utils";
import { AlertTriangle, Crown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface CancelInfoType {
  isSubscriptionCancelled: boolean;
  currentPeriodEnd: number;
}

const CancelPremiumPopup = ({ isSubscribed }: { isSubscribed: boolean }) => {
    // ─── Free trial flags ────────────────────────────────────────────────────────
  const [isTrial, setIsTrial] = useState<boolean>(false);
  const [trialEndsAt, setTrialEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<string>("");

  const formatDuration = (ms: number) => {
    if (ms <= 0) return "Expired";
    const totalSec = Math.floor(ms / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const { toast } = useToast();
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false);
  const [cancelInfo, setCancelInfo] = useState<{
    currentPeriodEnd: number;
    isSubscriptionCancelled: boolean;
  }>();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleCancelSubscription = async () => {
    setLoading(true);
    try {
      const subscriptionId = await getStoredValue<string>(
        "subscriptionId",
        "local"
      );

      let res;
      if (detectBrowser() === "firefox") {
        res = await new Promise<{ message: string }>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "CANCEL_SUBSCRIPTION", payload: { subscriptionId } },
            (response) => {
              resolve(response);
            }
          );
        });
      } else {
        res = await cancelSubscription(subscriptionId);
      }

      const { currentPeriodEnd, isSubscriptionCancelled } = res?.data || {};
      setCancelInfo({ currentPeriodEnd, isSubscriptionCancelled });
      toast({
        description: res.message || "Cancel subscription successfully",
        style: TOAST_STYLE_CONFIG_INFO,
      });
    } catch (error) {
      console.log("Error cancel subscription", error);
      toast({
        description: "Something went wrong while canceling the subscription",
        style: TOAST_STYLE_CONFIG,
        duration: 2000,
      });
    } finally {
      setLoading(false);
      setShowCancelDialog(false);
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const fetchCancelInfo = async () => {
      const info = await new Promise<CancelInfoType>((resolve, reject) => {
        chrome.storage.local.get(
          ["currentPeriodEnd", "isSubscriptionCancelled"],
          (result) => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            resolve(result as CancelInfoType);
          }
        );
      });
      const { currentPeriodEnd, isSubscriptionCancelled } = info;
      setCancelInfo({ currentPeriodEnd, isSubscriptionCancelled });
    };

    if (isSubscribed) fetchCancelInfo();
  }, [isSubscribed]);

  // Load trial flags when user has effective access (could be trial)
  useEffect(() => {
    if (!isSubscribed) {
      setIsTrial(false);
      setTrialEndsAt(null);
      setRemaining("");
      return;
    }

    chrome.storage.local.get(["isTrial", "trialEndsAt"], (result) => {
      const trial = !!result?.isTrial;
      const endsAt = typeof result?.trialEndsAt === "number" ? result.trialEndsAt : null;
      setIsTrial(trial);
      setTrialEndsAt(endsAt);
    });
  }, [isSubscribed]);

    // Live countdown while on trial
  useEffect(() => {
    if (!isTrial || !trialEndsAt) {
      setRemaining("");
      return;
    }
    const update = () => setRemaining(formatDuration(trialEndsAt - Date.now()));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [isTrial, trialEndsAt]);


  const formattedEndDate = useMemo(() => {
    return cancelInfo?.currentPeriodEnd
      ? new Date(cancelInfo.currentPeriodEnd * 1000).toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )
      : null;
  }, [cancelInfo]);

  return (
    <>
      {isSubscribed && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="gpt:relative gpt:h-9 gpt:px-3 gpt:bg-gradient-to-r gpt:from-amber-500/10 gpt:to-orange-500/10 gpt:hover:from-amber-500/20 gpt:hover:to-orange-500/20 gpt:border gpt:border-amber-500/20 gpt:hover:border-amber-500/30 gpt:transition-all gpt:duration-200"
            >
              <Crown className="gpt:h-4 gpt:w-4 gpt:text-amber-600 gpt:mr-2" />
              <Badge
                variant="secondary"
                className="gpt:bg-gradient-to-r gpt:from-amber-500 gpt:to-orange-500 gpt:text-white gpt:border-0 gpt:text-xs gpt:font-medium gpt:px-2 gpt:py-0.5"
              >
                PREMIUM
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="gpt:w-64 gpt:p-0 gpt:bg-gray-50 gpt:dark:bg-gray-900"
            align="end"
          >
            <div className="gpt:p-2 gpt:space-y-3">
                {isTrial ? (
                  <div className="flex items-center gap-2">
                    <Crown className="gpt:h-5 gpt:w-5 gpt:text-amber-600" />
                    <div>
                      <h4 className="gpt:font-semibold gpt:text-sm">Free Trial (24h)</h4>
                      <p className="gpt:text-xs gpt:text-gray-500 gpt:dark:text-gray-400">
                        {remaining ? `Ends in ${remaining}` : "Ends soon"}
                      </p>
                    </div>
                  </div>
                ) : cancelInfo?.isSubscriptionCancelled ? (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="gpt:h-5 gpt:w-5 gpt:text-orange-600" />
                    <div>
                      <h4 className="gpt:font-semibold gpt:text-sm">Subscription Cancelled</h4>
                      {formattedEndDate && (
                        <p className="gpt:text-xs">Ends on {formattedEndDate || ""}</p>
                      )}
                    </div>
                  </div>
                ) : (
                <div className="flex items-center gap-2">
                  <Crown className="gpt:h-5 gpt:w-5 gpt:text-amber-600" />
                  <div>
                    <h4 className="gpt:font-semibold gpt:text-sm">Premium Member</h4>
                  </div>
                </div>
              )}
              {!isTrial && !cancelInfo?.isSubscriptionCancelled && (
                <div className="gpt:space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gpt:w-full gpt:justify-start gpt:text-left gpt:h-auto gpt:p-2 gpt:text-red-600 gpt:hover:text-red-700 gpt:hover:bg-red-50"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    <div>
                      <div className="gpt:font-medium gpt:text-[16px]">
                        Cancel Subscription
                      </div>
                      <div className="gpt:text-xs gpt:text-gray-400">
                        End premium benefits
                      </div>
                    </div>
                  </Button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent
          onInteractOutside={(e: Event) => {
            e.preventDefault();
          }}
          className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:rounded-2xl"
        >
          <DialogHeader className="gpt:space-y-2.5">
            <DialogTitle className="gpt:flex gpt:items-center gpt:gap-2">
              <AlertTriangle className="gpt:h-5 gpt:w-5 gpt:text-amber-600" />
              Cancel Premium Subscription?
            </DialogTitle>
            <DialogDescription className="gpt:text-left">
              Are you sure you want to cancel your premium subscription?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gpt:flex gpt:justify-end gpt:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all"
            >
              Keep Premium
            </Button>
            <LoadingButton
              loading={loading}
              onClick={handleCancelSubscription}
              className="gpt:bg-red-600 gpt:hover:bg-red-700"
            >
              Yes, Cancel Subscription
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CancelPremiumPopup;
