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
import { TOAST_STYLE_CONFIG, TOAST_STYLE_CONFIG_INFO } from "@/lib/constants";
import { startOtp, verifyOtp } from "@/lib/utils";
import { Mail, ShieldCheck } from "lucide-react";
import { FC, useState } from "react";

interface SignInPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignedIn: (token: string) => void;
  forCheckout?: boolean;
  forPromoCode?: boolean;
}

const SignInPopup: FC<SignInPopupProps> = ({ open, onOpenChange, onSignedIn, forCheckout = false, forPromoCode = false }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [codeSent, setCodeSent] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const resetState = () => {
    setEmail("");
    setCode("");
    setCodeSent(false);
    setSending(false);
    setVerifying(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      toast({ description: "Please enter a valid email address.", style: TOAST_STYLE_CONFIG });
      return;
    }
    setSending(true);
    try {
      await startOtp(trimmed);
      setEmail(trimmed);
      setCodeSent(true);
      toast({ description: "We sent a code to your email. Enter it below to continue.", style: TOAST_STYLE_CONFIG_INFO });
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast({ description: "Couldn't send the code. Please try again.", style: TOAST_STYLE_CONFIG });
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      toast({ description: "Please enter the code from your email.", style: TOAST_STYLE_CONFIG });
      return;
    }
    setVerifying(true);
    try {
      const data = await verifyOtp(email, trimmedCode);
      toast({ description: "You're signed in!", style: TOAST_STYLE_CONFIG_INFO });
      onSignedIn(data.token);
      handleOpenChange(false);
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast({ description: "That code didn't work. Please try again.", style: TOAST_STYLE_CONFIG });
    } finally {
      setVerifying(false);
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
              <Mail className="gpt:h-5 gpt:w-5 gpt:text-amber-600" />
              Sign In
            </div>
          </DialogTitle>
          <DialogDescription className="gpt:text-center gpt:text-sm gpt:mt-2">
            {codeSent
              ? "Enter the code we emailed you to finish signing in."
              : "Enter your email and we'll send you a one-time code."}
          </DialogDescription>
        </DialogHeader>

        {forCheckout && (
          <div className="gpt:border gpt:border-amber-200 gpt:dark:border-amber-900/50 gpt:bg-amber-50 gpt:dark:bg-amber-950/30 gpt:rounded-lg gpt:p-3 gpt:text-sm gpt:text-gray-700 gpt:dark:text-gray-200">
            <div className="gpt:flex gpt:items-start gpt:gap-2">
              <ShieldCheck className="gpt:w-4 gpt:h-4 gpt:mt-0.5 gpt:flex-shrink-0 gpt:text-amber-600 gpt:dark:text-amber-500" />
              <p className="gpt:text-left">
                Before you upgrade, we need you to sign in to (or create) an account with your
                email. Once you verify the code, we'll take you straight to secure checkout.
              </p>
            </div>
          </div>
        )}

        {forPromoCode && (
          <div className="gpt:border gpt:border-amber-200 gpt:dark:border-amber-900/50 gpt:bg-amber-50 gpt:dark:bg-amber-950/30 gpt:rounded-lg gpt:p-3 gpt:text-sm gpt:text-gray-700 gpt:dark:text-gray-200">
            <div className="gpt:flex gpt:items-start gpt:gap-2">
              <ShieldCheck className="gpt:w-4 gpt:h-4 gpt:mt-0.5 gpt:flex-shrink-0 gpt:text-amber-600 gpt:dark:text-amber-500" />
              <p className="gpt:text-left">
                To redeem a promo code, we first need to verify your email. After you sign in,
                if your account isn't already premium, you'll be able to enter your code.
              </p>
            </div>
          </div>
        )}

        <div className="gpt:flex gpt:flex-col gpt:gap-4 gpt:mt-2">
          <div className="gpt:flex gpt:flex-col gpt:gap-2">
            <Label htmlFor="gpt-signin-email">Email</Label>
            <Input
              id="gpt-signin-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              disabled={codeSent || sending}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !codeSent) handleSendCode(); }}
            />
          </div>

          {!codeSent ? (
            <LoadingButton
              loading={sending}
              onClick={handleSendCode}
              className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
            >
              Send Code
            </LoadingButton>
          ) : (
            <>
              <div className="gpt:flex gpt:flex-col gpt:gap-2">
                <Label htmlFor="gpt-signin-code">Verification Code</Label>
                <Input
                  id="gpt-signin-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  disabled={verifying}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
                />
              </div>
              <LoadingButton
                loading={verifying}
                onClick={handleVerify}
                className="gpt:w-full gpt:font-medium gpt:py-2 gpt:px-4 gpt:rounded-full gpt:bg-gray-800 gpt:dark:bg-gray-50 gpt:text-gray-50 gpt:dark:text-gray-800"
              >
                Verify &amp; Sign In
              </LoadingButton>
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sending}
                className="gpt:text-xs gpt:text-gray-500 gpt:dark:text-gray-400 gpt:underline-offset-4 hover:gpt:underline gpt:disabled:opacity-50"
              >
                Resend code
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignInPopup;
