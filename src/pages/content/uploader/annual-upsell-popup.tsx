import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { FC, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  getSubscriptionDetails,
  switchSubscriptionToPrice,
  toAnnualPriceId,
  isAnnualPriceId,
  getStoredValue,
  detectBrowser,
  fetchStripeProducts,
} from "@/lib/utils";
import { DISCOUNT_PRICE_ANNUAL_ID, FIRST_DISCOUNT_PRICE_ANNUAL_ID, LIFETIME_DEAL_ID, LIFETIME_PRICE, ORIGINAL_PRICE_ANNUAL_ID, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { createCheckoutSession } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showConfirmationDirectly?: boolean;
}

const AnnualUpsellPopup: FC<Props> = ({ open, onOpenChange, showConfirmationDirectly = false }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [lifetimeLoading, setLifetimeLoading] = useState(false);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);
  const [defaultMonthlyId, setDefaultMonthlyId] = useState<string | null>(null);
  const [annualLabel, setAnnualLabel] = useState<string>(""); // "$49.99/year" etc.
  const [targetAnnualId, setTargetAnnualId] = useState<string | null>(null);
  const [showAnnualConfirmation, setShowAnnualConfirmation] = useState(false);
  const [isAnnualUser, setIsAnnualUser] = useState(false);

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        // Get current plan
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
        const cpid = details?.currentPriceId ?? null;
        setCurrentPriceId(cpid);

        // If user is on lifetime plan, close immediately (no upsell needed)
        if (details?.isLifetime === true) {
          onOpenChange(false);
          return;
        }

        // Check if user is on annual plan
        const isAnnual = isAnnualPriceId(cpid);
        setIsAnnualUser(isAnnual);

        // If already on annual, we'll show lifetime option only (don't close)
        if (isAnnual) {
          // For annual users, we only show lifetime option, so skip annual mapping
          return;
        }

        // Also fetch default product price id (for mapping fallback)
        try {
          // minimal dependency: reuse your product fetcher
          const product = await (async () => {
            if (detectBrowser() === "firefox") {
              return await new Promise<any>((resolve) => {
                chrome.runtime.sendMessage({ type: "GET_PRODUCTS_PRICES" }, (res) => resolve(res));
              });
            }
            return await fetchStripeProducts();
          })();
          const defId = product?.prices?.priceId ?? null;
          setDefaultMonthlyId(defId);

          const mapped = toAnnualPriceId(cpid, defId);
          setTargetAnnualId(mapped);
        } catch {
          // If we can’t get product, still try mapping without default
          const mapped = toAnnualPriceId(cpid, null);
          setTargetAnnualId(mapped);
        }
        // Derive the human label once we know (or guessed) target id
        const id = toAnnualPriceId(cpid, null);
        if (id === ORIGINAL_PRICE_ANNUAL_ID) setAnnualLabel("USD $49.99/year");
        else if (id === FIRST_DISCOUNT_PRICE_ANNUAL_ID) setAnnualLabel("USD $29.99/year");
        else if (id === DISCOUNT_PRICE_ANNUAL_ID) setAnnualLabel("USD $19.99/year");
        else setAnnualLabel("USD $—/year");

        // If showConfirmationDirectly is true, show confirmation dialog immediately
        if (showConfirmationDirectly && targetAnnualId) {
          setShowAnnualConfirmation(true);
        }
      } catch {
        toast({
          description: "Couldn’t check your current plan right now.",
          style: TOAST_STYLE_CONFIG,
        });
        onOpenChange(false);
      }
    })();
  }, [open, onOpenChange, toast]);

  const handleSwitchToAnnual = async () => {
    if (!targetAnnualId) {
      toast({
        description: "Annual plan not available for your current subscription.",
        style: TOAST_STYLE_CONFIG,
      });
      return;
    }
    setLoading(true);
    try {
      const subscriptionId = await getStoredValue<string>("subscriptionId", "local");
      if (!subscriptionId) throw new Error("Missing subscription id");

      let resp: any;
      if (detectBrowser() === "firefox") {
        resp = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "SWITCH_SUBSCRIPTION_PRICE",
              payload: { subscriptionId, priceId: targetAnnualId },
            },
            (res) => resolve(res)
          );
        });
      } else {
        resp = await switchSubscriptionToPrice(subscriptionId, targetAnnualId);
      }

      // Update local storage to reflect annual plan immediately
      localStorage.setItem("gptr/annualPlan", "true");
      
      toast({
        description: "✅ You're now on the annual plan!",
        style: TOAST_STYLE_CONFIG_INFO,
      });
      setShowAnnualConfirmation(false);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({
        description: "Couldn't switch to annual right now.",
        style: TOAST_STYLE_CONFIG,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToLifetime = async () => {
    setLifetimeLoading(true);
    try {
      const storageData = await new Promise<any>((resolve, reject) => {
        chrome.storage.sync.get(
          ["email", "name", "openaiId", "picture"],
          (result) => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError);
            }
            resolve(result);
          }
        );
      });
      const { email, name, openaiId, picture } = storageData;

      if (!openaiId) {
        toast({
          description: "Unable to get user information.",
          style: TOAST_STYLE_CONFIG,
        });
        return;
      }

      const payload = { openaiId, email, name, picture, priceId: LIFETIME_DEAL_ID };
      let sessionUrl: string;
      if (detectBrowser() === "firefox") {
        const session = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "CREATE_CHECKOUT_SESSION", payload },
            (response) => resolve(response)
          );
        });
        sessionUrl = session?.url;
      } else {
        const session = await createCheckoutSession(payload);
        sessionUrl = session?.url;
      }

      if (!sessionUrl) {
        throw new Error("No checkout URL");
      }
      onOpenChange(false);
      window.open(sessionUrl, "_self");
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        description: "Something went wrong while attempting to checkout",
        style: TOAST_STYLE_CONFIG,
        duration: 5000,
      });
    } finally {
      setLifetimeLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showConfirmationDirectly} onOpenChange={onOpenChange}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[620px] gpt:rounded-2xl"
        >
          <DialogHeader>
          <DialogTitle className="gpt:text-xl gpt:font-bold gpt:text-center">
            {isAnnualUser ? "Upgrade to Lifetime Deal" : "Upgrade Your Plan & Save"}
          </DialogTitle>
          <DialogDescription className="gpt:text-center gpt:text-sm gpt:mt-2">
            {isAnnualUser 
              ? `Get lifetime access for USD ${LIFETIME_PRICE} - one payment, forever.`
              : `Love the extension? Switch to annual (${annualLabel || "save 20%"}) or get lifetime access for USD ${LIFETIME_PRICE}.`}
          </DialogDescription>
          </DialogHeader>

          <div className="gpt:flex gpt:flex-col gpt:gap-3 gpt:mt-2">
            {!isAnnualUser && (
              <LoadingButton
                loading={loading}
                onClick={() => setShowAnnualConfirmation(true)}
                className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
              >
                Switch to Annual {annualLabel ? `(${annualLabel})` : ""}
              </LoadingButton>
            )}
          <LoadingButton
            loading={lifetimeLoading}
            onClick={handleSwitchToLifetime}
            className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
          >
            Get Lifetime Deal (USD {LIFETIME_PRICE})
          </LoadingButton>
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700"
            >
              Not now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Annual Confirmation Dialog */}
      <Dialog open={showAnnualConfirmation || (showConfirmationDirectly && open)} onOpenChange={(isOpen) => {
        setShowAnnualConfirmation(isOpen);
        if (!isOpen) {
          onOpenChange(false);
        }
      }}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[620px] gpt:rounded-2xl"
        >
          <DialogHeader>
            <DialogTitle className="gpt:text-xl gpt:font-bold gpt:text-center">
              Confirm Switch to Annual
            </DialogTitle>
            <DialogDescription className="gpt:text-center gpt:text-sm gpt:mt-2">
              You're about to switch to the annual plan {annualLabel ? `(${annualLabel})` : ""}. This change will take effect immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="gpt:flex gpt:flex-col gpt:gap-3 gpt:mt-4">
            <LoadingButton
              loading={loading}
              onClick={handleSwitchToAnnual}
              className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
            >
              Confirm Switch
            </LoadingButton>
            <Button
              variant="ghost"
              onClick={() => setShowAnnualConfirmation(false)}
              className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default AnnualUpsellPopup;
