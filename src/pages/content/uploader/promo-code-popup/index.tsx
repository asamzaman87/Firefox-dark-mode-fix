import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/loading-button";
import { useToast } from "@/hooks/use-toast";
import { TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO, BACKEND_URI } from "@/lib/constants";
import { secureFetch } from "@/lib/utils";
import { Gift } from "lucide-react";
import { FC, useState } from "react";

interface PromoCodePopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string | null;
  openaiId?: string | null;
  onRedeemed: () => void;
  onReverted: () => void;
}

const PromoCodePopup: FC<PromoCodePopupProps> = ({
  open,
  onOpenChange,
  email,
  openaiId,
  onRedeemed,
  onReverted,
}) => {
  const { toast } = useToast();
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [reverting, setReverting] = useState<boolean>(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setCode("");
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast({ description: "Please enter a promo code.", style: TOAST_STYLE_CONFIG });
      return;
    }
    setLoading(true);
    try {
      const data = await secureFetch(`${BACKEND_URI}/gpt-reader/redeem-promo-code`, {
        method: "POST",
        body: JSON.stringify({ code: code.trim(), openaiId: openaiId ?? undefined }),
      });
      if (!data.success) {
        toast({ description: data.message || "Failed to redeem code.", style: TOAST_STYLE_CONFIG });
        return;
      }
      const expiresDate = data.expiresAt
        ? new Date(data.expiresAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
        : null;
      toast({
        description: expiresDate
          ? `Promo code applied! You have free access until ${expiresDate}.`
          : "Promo code applied! Enjoy your free access.",
        style: TOAST_STYLE_CONFIG_INFO,
      });
      handleOpenChange(false);
      onRedeemed();
    } catch (err: any) {
      toast({ description: err?.message || "Failed to redeem code. Please try again.", style: TOAST_STYLE_CONFIG });
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async () => {
    setReverting(true);
    try {
      await secureFetch(`${BACKEND_URI}/gpt-reader/revert-promo-redemption`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast({ description: "Reverted to free user.", style: TOAST_STYLE_CONFIG_INFO });
      handleOpenChange(false);
      onReverted();
    } catch (err: any) {
      toast({ description: err?.message || "Failed to revert. Please try again.", style: TOAST_STYLE_CONFIG });
    } finally {
      setReverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onInteractOutside={(e: Event) => e.preventDefault()}
        className="gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[460px] gpt:rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle className="gpt:text-xl gpt:font-bold gpt:text-center">
            <div className="gpt:flex gpt:items-center gpt:justify-center gpt:gap-2">
              <Gift className="gpt:h-5 gpt:w-5 gpt:text-amber-600" />
              Enter Promo Code
            </div>
          </DialogTitle>
          <DialogDescription className="gpt:text-center gpt:text-sm gpt:mt-2">
            Enter your promo code below to activate free access.
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:flex gpt:flex-col gpt:gap-4 gpt:mt-2">
          <div className="gpt:flex gpt:flex-col gpt:gap-2">
            <Label htmlFor="gpt-promo-code">Promo Code</Label>
            <Input
              id="gpt-promo-code"
              type="text"
              placeholder="e.g. READEON-JULY"
              value={code}
              disabled={loading}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>

          <LoadingButton
            loading={loading}
            onClick={handleSubmit}
            className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
          >
            Apply Code
          </LoadingButton>

          {import.meta.env.DEV && (
            <LoadingButton
              loading={reverting}
              onClick={handleRevert}
              className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-red-100 gpt:dark:bg-red-950 gpt:text-red-700 gpt:dark:text-red-300"
            >
              [Dev] Revert to Normal User
            </LoadingButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PromoCodePopup;
