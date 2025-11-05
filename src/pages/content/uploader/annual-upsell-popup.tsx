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
  reconcileScheduled199Flag,
  fetchStripeProducts,
} from "@/lib/utils";
import { DISCOUNT_PRICE_ANNUAL_ID, FIRST_DISCOUNT_PRICE_ANNUAL_ID, ORIGINAL_PRICE_ANNUAL_ID, SCHEDULED_ANNUAL_AT, SCHEDULED_ANNUAL_FLAG, TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AnnualUpsellPopup: FC<Props> = ({ open, onOpenChange }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentPriceId, setCurrentPriceId] = useState<string | null>(null);
  const [defaultMonthlyId, setDefaultMonthlyId] = useState<string | null>(null);
  const [annualLabel, setAnnualLabel] = useState<string>(""); // "$49.99/year" etc.
  const [targetAnnualId, setTargetAnnualId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        if (reconcileScheduled199Flag()) {
         setTargetAnnualId(DISCOUNT_PRICE_ANNUAL_ID);
         setAnnualLabel("USD $19.99/year");
         // We don't need current/default price IDs in this path; skip network calls.
         return;
        }
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

        // If already on annual, just close quietly
        if (isAnnualPriceId(cpid)) {
          onOpenChange(false);
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
      } catch {
        toast({
          description: "Couldn’t check your current plan right now.",
          style: TOAST_STYLE_CONFIG,
        });
        onOpenChange(false);
      }
    })();
  }, [open, onOpenChange, toast]);

  const handleSwitch = async () => {
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

      // Mark locally that the user has chosen to switch to annual (effective next cycle).
      // Use backend-returned currentPeriodEnd (seconds) for correct expiry handling.
      const whenFromResp: number | null =
        typeof resp?.currentPeriodEnd === "number" ? resp.currentPeriodEnd : null;
      window.localStorage.setItem(SCHEDULED_ANNUAL_FLAG, "true");
      if (whenFromResp) {
        window.localStorage.setItem(SCHEDULED_ANNUAL_AT, String(whenFromResp));
      } else {
        // No known effective date → clear timestamp to avoid immediate expiry logic
        window.localStorage.removeItem(SCHEDULED_ANNUAL_AT);
      }
      
      toast({
        description: "✅ You’ll be on the annual plan starting next cycle.",
        style: TOAST_STYLE_CONFIG_INFO,
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast({
        description: "Couldn’t switch to annual right now.",
        style: TOAST_STYLE_CONFIG,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[620px] gpt:rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="gpt:text-xl gpt:font-bold gpt:text-center">
            Switch to Annual & Save 20%
          </DialogTitle>
          <DialogDescription className="gpt:text-center gpt:text-sm gpt:mt-2">
            Love the extension? Pay {annualLabel || "annually"} and save 20% compared to monthly.
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:flex gpt:flex-col gpt:gap-3 gpt:mt-2">
          <LoadingButton
            loading={loading}
            onClick={handleSwitch}
            className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
          >
            Switch to Annual {annualLabel ? `(${annualLabel})` : ""}
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
  );
};

export default AnnualUpsellPopup;
