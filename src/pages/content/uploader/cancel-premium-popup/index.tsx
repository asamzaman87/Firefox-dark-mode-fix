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
import {
  DISCOUNT_PRICE_ID,
  FIRST_DISCOUNT_PRICE_ID,
  ORIGINAL_PRICE_ID,
  TOAST_STYLE_CONFIG,
  TOAST_STYLE_CONFIG_INFO,
} from "@/lib/constants";
import {
  cancelSubscription,
  detectBrowser,
  fetchStripeProducts,
  getStoredValue,
  getSubscriptionDetails,
  switchSubscriptionToPrice,
} from "@/lib/utils";
import { AlertTriangle, Crown } from "lucide-react";
import { FC, useEffect, useMemo, useState } from "react";

/* Local storage keys for tracking a scheduled downgrade chosen in the UI */
const SCHEDULED_199_FLAG = "gptr/scheduledDowngradeTo199";
const SCHEDULED_199_AT = "gptr/scheduledDowngradeAt";

/* Small helpers for local flag management */
const getScheduledAt = (): number | null => {
  const raw = window.localStorage.getItem(SCHEDULED_199_AT);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
};
const setScheduled = (atSec?: number | null) => {
  window.localStorage.setItem(SCHEDULED_199_FLAG, "true");
  if (typeof atSec === "number" && atSec > 0) {
    window.localStorage.setItem(SCHEDULED_199_AT, String(atSec));
  }
};
const clearScheduled = () => {
  window.localStorage.removeItem(SCHEDULED_199_FLAG);
  window.localStorage.removeItem(SCHEDULED_199_AT);
};

/* ──────────────────────────────────────────────────────────────────────────────
 * Popup 2: “Stay for $1.99?” (offer)
 * ──────────────────────────────────────────────────────────────────────────── */
const StayOfferPopup: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => Promise<void> | void;
  onCancelAnyway: () => void;
  loading: boolean;
  nextCycleDate?: string | null;
}> = ({ open, onOpenChange, onAccept, onCancelAnyway, loading, nextCycleDate }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[620px] gpt:rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="gpt:text-xl gpt:font-bold gpt:text-center">
            <div className="gpt:flex gpt:items-center gpt:justify-center gpt:gap-2">
              <Crown className="gpt:h-5 gpt:w-5 gpt:text-amber-600" />
              Stay & Save: Switch to $1.99/month
            </div>
          </DialogTitle>
          <DialogDescription className="gpt:text-center gpt:text-sm gpt:mt-2">
            Keep Premium for the rest of your current cycle, then pay{" "}
            <strong>$1.99/month</strong> starting next billing period
            {nextCycleDate ? ` (after ${nextCycleDate})` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:flex gpt:flex-col gpt:gap-4 gpt:mt-2">
          <LoadingButton
            loading={loading}
            onClick={onAccept}
            className={
              "gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
            }
          >
            <Crown className="gpt:mr-2 gpt:h-4 gpt:w-4" />
            Switch to $1.99/month
          </LoadingButton>

          <Button
            variant="ghost"
            onClick={onCancelAnyway}
            className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700"
          >
            <AlertTriangle className="gpt:mr-2 gpt:h-4 gpt:w-4 gpt:text-red-600" />
            Actually cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ──────────────────────────────────────────────────────────────────────────────
 * Popup 3: “You already scheduled $1.99 — still want to cancel?”
 * ──────────────────────────────────────────────────────────────────────────── */
const AlreadySwitchedPopup: FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelAnyway: () => Promise<void> | void;
  onKeep: () => void;
  loading: boolean;
  nextCycleDate?: string | null;
}> = ({ open, onOpenChange, onCancelAnyway, onKeep, loading, nextCycleDate }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[620px] gpt:rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="gpt:text-xl gpt:font-bold gpt:text-center">
            <div className="gpt:flex gpt:items-center gpt:justify-center gpt:gap-2">
              <Crown className="gpt:h-5 gpt:w-5 gpt:text-amber-600" />
              You’re already switching to $1.99
            </div>
          </DialogTitle>
          <DialogDescription className="gpt:text-center gpt:text-sm gpt:mt-2">
            You’ve scheduled a switch to <strong>$1.99/month</strong>
            {nextCycleDate ? ` after ${nextCycleDate}` : ""}. Do you still want
            to cancel now?
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:flex gpt:flex-col gpt:gap-4 gpt:mt-2">
          <Button
            variant="ghost"
            onClick={onKeep}
            className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:border gpt:border-gray-200 dark:border-gray-700"
          >
            Keep the $1.99 plan
          </Button>

          <LoadingButton
            loading={loading}
            onClick={onCancelAnyway}
            className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-red-600 gpt:hover:bg-red-700 gpt:text-white"
          >
            Yes, cancel subscription
          </LoadingButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ────────────────────────────────────────────────────────────────────────────── */

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
  const [showCancelDialog, setShowCancelDialog] = useState<boolean>(false); // Popup 1
  const [showOfferDialog, setShowOfferDialog] = useState<boolean>(false);   // Popup 2
  const [showAlreadyDialog, setShowAlreadyDialog] = useState<boolean>(false); // Popup 3

  const [cancelInfo, setCancelInfo] = useState<{
    currentPeriodEnd: number;
    isSubscriptionCancelled: boolean;
  }>();
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);        // for real cancel
  const [offerLoading, setOfferLoading] = useState<boolean>(false); // for switching to 1.99

  // For display/debug only (don’t rely on these for eligibility decisions)
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);
  const [defaultPriceId, setDefaultPriceId] = useState<string | null>(null);

  // Load product default price (≈ $4.99)
  useEffect(() => {
    (async () => {
      try {
        const product = await fetchStripeProducts();
        setDefaultPriceId(product?.prices?.priceId ?? null);
      } catch {
        setDefaultPriceId(null);
      }
    })();
  }, []);

  const handleCancelSubscription = async () => {
    setLoading(true);
    try {
      const subscriptionId = await getStoredValue<string>(
        "subscriptionId",
        "local"
      );

      let res: any;
      if (detectBrowser() === "firefox") {
        res = await new Promise<{ message: string }>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "CANCEL_SUBSCRIPTION", payload: { subscriptionId } },
            (response) => resolve(response)
          );
        });
      } else {
        res = await cancelSubscription(subscriptionId);
      }

      const { currentPeriodEnd, isSubscriptionCancelled } = (res as any)?.data || {};
      setCancelInfo({ currentPeriodEnd, isSubscriptionCancelled });

      // Cancelling means the “scheduled $1.99 later” plan is obsolete
      clearScheduled();

      toast({
        description: (res as any)?.message || "Cancel subscription successfully",
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
      setShowAlreadyDialog(false);
      setIsOpen(false);
    }
  };

  // Pull cancel status & period end that we store locally
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
      const endsAt =
        typeof result?.trialEndsAt === "number" ? result.trialEndsAt : null;
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
          { year: "numeric", month: "long", day: "numeric" }
        )
      : null;
  }, [cancelInfo]);

  // Helpers (pure)
  const isEligibleFor199 = (priceId: string | null, defPriceId: string | null) => {
    if (!priceId) return false;
    if (priceId === DISCOUNT_PRICE_ID) return false; // already on $1.99
    const candidates = [defPriceId, FIRST_DISCOUNT_PRICE_ID, ORIGINAL_PRICE_ID].filter(Boolean) as string[];
    return candidates.includes(priceId);
  };

  const isOn299or499 = (priceId: string | null, defPriceId: string | null) => {
    if (!priceId) return false;
    const candidates = [defPriceId, FIRST_DISCOUNT_PRICE_ID, ORIGINAL_PRICE_ID].filter(Boolean) as string[];
    return candidates.includes(priceId);
  };

  // Entry point when user clicks “Cancel Subscription”
  const handleOpenCancelClick = async () => {
    try {
      let details;
      if (detectBrowser() === "firefox") {
        details = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ type: "GET_SUBSCRIPTION_DETAILS" }, (response) =>
            resolve(response)
          );
        });
      } else {
        details = await getSubscriptionDetails();
      }
      const current = details?.currentPriceId ?? null;
      setCurrentPriceId(current);

      // If backend returned the period end, update local view so the popups can reflect it
      if (typeof details?.currentPeriodEnd === "number") {
        setCancelInfo((prev) => ({
          currentPeriodEnd: details.currentPeriodEnd!,
          isSubscriptionCancelled: prev?.isSubscriptionCancelled ?? false,
        }));
      }

      // Make sure we have default price id
      let dpid = defaultPriceId;
      if (!dpid) {
        try {
          const product = await fetchStripeProducts();
          dpid = product?.prices?.priceId ?? null;
          setDefaultPriceId(dpid);
        } catch {
          dpid = null;
        }
      }

      // Reconcile scheduled flag with reality
      let alreadyScheduled = window.localStorage.getItem(SCHEDULED_199_FLAG) === "true";
      const at = getScheduledAt();
      const nowSec = Math.floor(Date.now() / 1000);

      // If user has already moved to $1.99 (backend truth) → clear stale flag
      if (current === DISCOUNT_PRICE_ID) {
        clearScheduled();
        alreadyScheduled = false;
      }

      // If flag says scheduled but we have no timestamp or timestamp passed → clear too
      if (alreadyScheduled && (!at || at <= nowSec)) {
        clearScheduled();
        alreadyScheduled = false;
      }

      // Branching:
      // A) If user previously chose $1.99 AND they’re still on 2.99/4.99 → show popup #3
      if (alreadyScheduled && isOn299or499(current, dpid)) {
        setShowAlreadyDialog(true);
        return;
      }

      // B) Otherwise, if eligible (on 2.99/4.99) → show popup #2
      if (isEligibleFor199(current, dpid)) {
        setShowOfferDialog(true);
        return;
      }

      // C) Fallback → regular confirm popup #1
      setShowCancelDialog(true);
    } catch {
      setShowCancelDialog(true);
    }
  };

  // Accept: schedule price change to $1.99 starting next cycle
  const handleAccept199 = async () => {
    setOfferLoading(true);
    try {
      const subscriptionId = await getStoredValue<string>("subscriptionId", "local");
      if (!subscriptionId) throw new Error("Missing subscriptionId");

      let resp;
      if (detectBrowser() === "firefox") {
        resp = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "SWITCH_SUBSCRIPTION_PRICE", payload: { subscriptionId, priceId: DISCOUNT_PRICE_ID } },
            (response) => resolve(response)
          );
        });
      } else {
        resp = await switchSubscriptionToPrice(subscriptionId, DISCOUNT_PRICE_ID);
      }
      const whenFromResp: number | null =
        typeof resp?.currentPeriodEnd === "number" ? resp.currentPeriodEnd : null;

      // Update local state so popups can show the date immediately
      if (whenFromResp) {
        setCancelInfo((prev) => ({
          currentPeriodEnd: whenFromResp,
          isSubscriptionCancelled: prev?.isSubscriptionCancelled ?? false,
        }));
      }

      // Track locally that user accepted the $1.99 switch (for popup #3 logic)
      setScheduled(whenFromResp ?? cancelInfo?.currentPeriodEnd ?? null);

      toast({
        description: "🎉 Your plan will switch to $1.99/month starting next cycle.",
        style: TOAST_STYLE_CONFIG_INFO,
      });
      setShowOfferDialog(false);
      setIsOpen(false);
    } catch (error) {
      console.log("Error switching price", error);
      toast({
        description: "Something went wrong while scheduling the price change",
        style: TOAST_STYLE_CONFIG,
        duration: 2000,
      });
    } finally {
      setOfferLoading(false);
    }
  };

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
                    onClick={handleOpenCancelClick}
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

      {/* Popup 1: Regular cancel confirmation */}
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

      {/* Popup 2: Stay-for-$1.99 offer */}
      <StayOfferPopup
        open={showOfferDialog}
        onOpenChange={setShowOfferDialog}
        onAccept={handleAccept199}
        onCancelAnyway={() => {
          setShowOfferDialog(false);
          setShowCancelDialog(true);
        }}
        loading={offerLoading}
        nextCycleDate={formattedEndDate}
      />

      {/* Popup 3: Already scheduled $1.99 → still cancel? */}
      <AlreadySwitchedPopup
        open={showAlreadyDialog}
        onOpenChange={setShowAlreadyDialog}
        onKeep={() => {
          setShowAlreadyDialog(false);
          setIsOpen(false);
        }}
        onCancelAnyway={handleCancelSubscription}
        loading={loading}
        nextCycleDate={formattedEndDate}
      />
    </>
  );
};

export default CancelPremiumPopup;
