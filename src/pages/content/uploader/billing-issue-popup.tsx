import { FC, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { LoadingButton } from "@/components/ui/loading-button";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";

interface BillingIssuePopupProps {
  open: boolean;
  onClose: (open: boolean) => void;
  onUpgrade: () => Promise<void> | void;
  openPremiumModal?: () => void;
}

const BillingIssuePopup: FC<BillingIssuePopupProps> = ({
  open,
  onClose,
  onUpgrade,
  openPremiumModal,
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    // Prefer opening the Premium modal (monthly/annual) if provided.
    if (typeof openPremiumModal === "function") {
      openPremiumModal();
      onClose(false);
      return;
    }

    // Backward-compat: fall back to the existing onUpgrade flow.
    setLoading(true);
    try {
      await onUpgrade();
      // success: navigation will unmount the dialog
    } catch {
      // errors handled by caller (toast shown there)
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        className="gpt:bg-gray-50 dark:bg-gray-800 gpt:border-none gpt:w-[95vw] gpt:max-w-[95vw] gpt:sm:w-[95vw] gpt:sm:max-w-[620px] gpt:md:w-[80vw] gpt:md:max-w-[750px] lg:gpt:w-[60vw] lg:gpt:max-w-[800px] xl:gpt:max-w-[900px] gpt:rounded-2xl"
      >
        <DialogHeader className="gpt:sr-only">
          <DialogTitle className="gpt:inline-flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-2">
            Billing Issue
          </DialogTitle>
          <DialogDescription className="gpt:sr-only">
            You no longer have access to premium
          </DialogDescription>
        </DialogHeader>

        <div className="gpt:w-full gpt:flex gpt:flex-col gpt:gap-6 gpt:justify-center gpt:items-center">
          <section className="gpt:flex gpt:flex-col gpt:justify-center gpt:items-center gpt:gap-4 gpt:text-justify">
            <h1 className="gpt:text-xl gpt:font-medium">
              Your monthly recurring payment seems to have failed
            </h1>
            <p className="gpt:text-base gpt:text-muted-foreground gpt:text-center">
              Please upgrade again if you wish to continue using premium features.
            </p>
          </section>

          <footer className="gpt:flex gpt:items-end gpt:justify-center gpt:gap-4 gpt:w-full">
            <LoadingButton
              loading={loading}
              onClick={handleClick}
              className={cn(
                "gpt:w-full gpt:max-w-sm gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full",
                "gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
              )}
            >
              <Crown className="gpt:mr-2 gpt:h-4 gpt:w-4" />
              Upgrade Membership
            </LoadingButton>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillingIssuePopup;
