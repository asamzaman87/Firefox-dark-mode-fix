/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FC, useEffect, useState } from "react";
import { CheckCircleIcon, Sparkles } from "lucide-react";
import {
  cn,
  createCheckoutSession,
  detectBrowser,
  fetchStripeProducts,
  formatPriceFromStripePrice,
} from "../../../lib/utils";
import { LoadingButton } from "@/components/ui/loading-button";
import { usePremiumModal } from "../../../context/premium-modal";
import { useToast } from "../../../hooks/use-toast";
import { DISCOUNT_FREQUENCY, DISCOUNT_PRICE_ID, FIRST_DISCOUNT_PRICE_ID, TOAST_STYLE_CONFIG } from "../../../lib/constants";
interface PremiumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, show $1.99/month and use discount price id for checkout */
  forceDiscount?: boolean;
}

export interface FetchUserType {
  email: string;
  name: string;
  openaiId: string;
  picture?: string;
}

type PlanType = "free" | "premium";

interface PlansDetails {
  type: PlanType;
  title: string;
  price: string;
  isCurrent: boolean;
  features: {
    key: string;
    label: string;
  }[];
}

export type Product = {
  id: string;
  name: string;
  description: string;
  metadata: {
    businessTag: string;
    [key: string]: string;
  };
  marketing_features: any[];
  prices: {
    priceId: string;
    active: boolean;
    unit_amount: number;
    currency: string;
    recurring: {
      interval: "day" | "week" | "month" | "year";
      interval_count: number;
      usage_type: "licensed" | "metered";
    };
    lookup_key: string;
    type: "recurring" | "one_time";
    unit_amount_decimal: string;
  };
};

export interface CheckoutPayloadType {
  openaiId: string;
  email: string;
  name: string;
  picture: string | undefined;
  priceId: string | undefined;
}

const PremiumModal: FC<PremiumModalProps> = ({ open, onOpenChange, forceDiscount = false }) => {
  const [product, setProduct] = useState<Product>();
  const [loading, setLoading] = useState<boolean>(false);
  const { reason } = usePremiumModal();
  const { toast } = useToast();
  const [openCount, setOpenCount] = useState<number | undefined>(undefined);
  // ADD: countdown gating for the X when forceDiscount is true
  const [closeCountdown, setCloseCountdown] = useState<number>(0);
  const [canClose,       setCanClose]       = useState<boolean>(!forceDiscount);

  // ADD: kick off a 3s countdown only when forced discount modal is opened
  useEffect(() => {
    if (!open || !forceDiscount) return;

    setCanClose(false);
    setCloseCountdown(3);

    const id = setInterval(() => {
      setCloseCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [open, forceDiscount]);

  // read openCount once to decide which discount label to show
  useEffect(() => {
    if (!open) return;
    try {
      chrome.storage.local.get("openCount").then((res) => {
        if (typeof res?.openCount === "number") setOpenCount(res.openCount);
      });
    } catch {
      /* noop */
    }
  }, [open]);

  const isFirstDiscount = forceDiscount && openCount === DISCOUNT_FREQUENCY;
  const premiumPriceLabel = forceDiscount
    ? isFirstDiscount
      ? "USD $2.99/month"
      : "USD $1.99/month"
    : formatPriceFromStripePrice(product?.prices);
  const discountTitlePrice = isFirstDiscount ? "$2.99/month" : "$1.99/month";
  // 4.99 → 2.99 is ~40% off; 4.99 → 1.99 is ~60% off
  const discountPercentCopy = isFirstDiscount
    ? "❗ Over 40% off the regular $4.99 price — CLOSE THIS POPUP AND ITS GONE ❗"
    : "❗ Over 60% off the regular $4.99 price — CLOSE THIS POPUP AND ITS GONE ❗";

  const plans: PlansDetails[] = [
    {
      type: "free",
      title: chrome.i18n.getMessage("free") || "Free",
      price: formatPriceFromStripePrice(),
      isCurrent: true,
      features: [
        {
          key: "listening",
          label: chrome.i18n.getMessage("listening") || "Unlimited listening to audio for your text",
        },
        {
          key: "transcriptions",
          label: chrome.i18n.getMessage("transcriptions") || "Unlimited transcriptions for your audio",
        },
        {
          key: "audio_player",
          label:
            chrome.i18n.getMessage("audio_player") ||
            "Audio player with limited features",
        },
        {
          key: "download_limit",
          label:
            chrome.i18n.getMessage("download_limit") ||
            "Text to speech downloads limited to 2500 characters",
        }
      ],
    },
    {
      type: "premium",
      title: chrome.i18n.getMessage("premium") || "Premium",
      price: premiumPriceLabel,
      isCurrent: false,
      features: [
        {
          key: "all_free_features",
          label: chrome.i18n.getMessage("all_free_features") || "Includes all free features",
        },
        {
          key: "audio_player",
          label:
            chrome.i18n.getMessage("audio_player") ||
            "Audio player with advanced features",
        },
        {
          key: "download_limit",
          label:
            chrome.i18n.getMessage("download_limit") ||
            "Text to speech downloads with no character limit",
        },
        {
          key: "download_with_text",
          label:
            chrome.i18n.getMessage("download_with_text") ||
            "Download while listening to audio",
        },
        {
          key: "download_transcript",
          label:
            chrome.i18n.getMessage("download_transcript") ||
            "Download transcribed text in txt or pdf format",
        },
        {
          key: "more_coming",
          label: chrome.i18n.getMessage("more_coming") || "More coming soon",
        },
      ],
    },
  ];

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        if (detectBrowser() === "firefox") {
          const product = await new Promise<Product>((resolve) => {
            chrome.runtime.sendMessage(
              { type: "GET_PRODUCTS_PRICES" },
              (response) => {
                resolve(response);
              }
            );
          });
          setProduct(product);
        } else {
          const product = await fetchStripeProducts();
          setProduct(product);
        }
      } catch (e) {
        console.error("Error while products fetching", e);
        toast({
          description: "Something went wrong while fetching product price",
          style: TOAST_STYLE_CONFIG,
          duration: 2000,
        });
      }
    };

    fetchProducts();
  }, []);

  const handleUpgradeClick = async () => {
    setLoading(true);

    try {
      const storageData = await new Promise<FetchUserType>(
        (resolve, reject) => {
          chrome.storage.sync.get(
            ["email", "name", "openaiId", "picture"],
            (result) => {
              if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
              }
              resolve(result as FetchUserType);
            }
          );
        }
      );
      const { email, name, openaiId, picture } = storageData;

      if (!openaiId) return;

      // Prefer Stripe Product metadata "discount_price_id" when forcing discount, else fall back constant
      const { openCount } = await chrome.storage.local.get("openCount");
      let priceIdToUse;
      if (openCount === DISCOUNT_FREQUENCY && forceDiscount) {
        priceIdToUse = FIRST_DISCOUNT_PRICE_ID;
      } else if (forceDiscount) {
        priceIdToUse = DISCOUNT_PRICE_ID;
      } else {
        priceIdToUse = product?.prices?.priceId;
      }
      
      const payload: CheckoutPayloadType = {
        openaiId,
        email,
        name,
        picture,
        priceId: priceIdToUse,
      };

      let sessionUrl: string;

      if (detectBrowser() === "firefox") {
        const session = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "CREATE_CHECKOUT_SESSION", payload: payload },
            (response) => {
              resolve(response);
            }
          );
        });
        sessionUrl = session?.url;
      } else {
        const session = await createCheckoutSession(payload);
        sessionUrl = session?.url;
      }

      window.open(sessionUrl, "_self");
      onOpenChange(false);
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        description: "Something went wrong while checkout",
        style: TOAST_STYLE_CONFIG,
        duration: 2000,
      });
    } finally {
      setLoading(false);
    }
  };
  // ADD: block close while counting down (forced discount only)
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && forceDiscount && !canClose) return; // block early close
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onInteractOutside={(e: Event) => {
          e.preventDefault();
        }}
        className={cn(
          "gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[95vw] gpt:sm:w-[95vw] gpt:sm:max-w-[665px] gpt:md:w-[85vw] gpt:md:max-w-[750px] gpt:lg:w-[70vw] gpt:lg:max-w-[800px] gpt:xl:max-w-[900px] gpt:rounded-2xl gpt:max-sm:w-screen gpt:max-sm:max-w-screen gpt:max-sm:h-screen gpt:max-sm:!rounded-none gpt:overflow-auto", "h-screen-if-short"
        )}
      >
        {/* ADD: top-right countdown → real X once canClose is true */}
        {forceDiscount && !canClose && (
          <div className="gpt:absolute gpt:top-4 gpt:right-4 gpt:z-[999]">
            <div
              aria-hidden="true"
              className="gpt:flex gpt:items-center gpt:justify-center gpt:w-12 gpt:h-12 gpt:rounded-full gpt:bg-white gpt:dark:bg-gray-800 gpt:opacity-100 gpt:text-lg gpt:text-gray-900 gpt:dark:text-gray-100 gpt:ring-2 gpt:ring-black/10 gpt:shadow-sm gpt:cursor-not-allowed gpt:select-none"
            >
              {closeCountdown || 3}
            </div>
          </div>
        )}
        <div className="gpt:relative">
        <DialogHeader>
          <DialogTitle className="gpt:text-2xl gpt:font-bold gpt:text-center">
            {forceDiscount
              ? `🔊 Special Offer - Premium for ${discountTitlePrice} 🔊`
              : chrome.i18n.getMessage("premium_required") ||
                "Hey! You just triggered a premium feature"}
            <br />
            <span className="gpt:font-normal gpt:text-[16px]">
              {forceDiscount
                ? discountPercentCopy
                : chrome.i18n.getMessage("premium_description") ||
                  "Upgrade your GPT Reader & Transcriber plan to access now"}
            </span>
          </DialogTitle>
          <DialogDescription className={cn("gpt:text-center", { "sr-only": reason === "" })}>
            <div className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-white gpt:dark:bg-gray-700 gpt:rounded-lg gpt:p-3 gpt:mt-4">
              <div className="gpt:flex gpt:items-start gpt:gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="gpt:text-left">
                  <p className="gpt:font-medium gpt:text-sm">Reason:</p>
                  <p className="gpt:text-sm gpt:mt-1">{reason}</p>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:grid gpt:grid-cols-1 gpt:sm:grid-cols-2 gpt:gap-4 gpt:py-4">
          {plans.map((plan) => (
            <div
              key={plan.type}
              className="gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:rounded-lg gpt:p-4 gpt:bg-white gpt:dark:bg-gray-700"
            >
              <h3 className="gpt:font-bold gpt:text-lg gpt:mb-1">{plan.title}</h3>
              <p className="gpt:text-sm gpt:text-gray-500 gpt:mb-4 gpt:font-medium">
                {plan.price}
              </p>

              <div className="gpt:flex gpt:justify-center gpt:mb-4">
                <LoadingButton
                  loading={!plan.isCurrent && loading}
                  disabled={plan.isCurrent}
                  onClick={
                    plan.type === "premium" ? handleUpgradeClick : undefined
                  }
                  className={cn(`gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full`, {
                    "gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800":
                      !plan.isCurrent,
                  })}
                >
                  {plan.isCurrent
                    ? chrome.i18n.getMessage("current_plan") || "Current Plan"
                    : chrome.i18n.getMessage("upgrade_to_pro") ||
                      "Upgrade to Pro"}
                </LoadingButton>
              </div>

              <ul className="gpt:space-y-2 gpt:text-sm gpt:mb-2">
                {plan.features.map((feature) => (
                  <li className="gpt:flex gpt:items-start" key={feature.key}>
                    <span className="gpt:mr-2">
                      <CheckCircleIcon />
                    </span>
                    <span>{feature.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PremiumModal;
