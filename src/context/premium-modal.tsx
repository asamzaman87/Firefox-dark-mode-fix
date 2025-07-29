import { createContext, useContext, useState, ReactNode } from "react";

// 1. Define types
type PremiumModalContextType = {
  open: boolean;
  setOpen: (value: boolean) => void;
  isSubscribed: boolean;
  setIsSubscribed: (value: boolean) => void;
  isTriggered: boolean;
  setIsTriggered: (value: boolean) => void;
  reason: string;
  setReason: (value: string) => void;
};

// 2. Create context
const PremiumModalContext = createContext<PremiumModalContextType | null>(null);

// 3. Provider component
export function PremiumModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isTriggered, setIsTriggered] = useState<boolean>(false);
  const [reason, setReason] = useState<string>("");

  return (
    <PremiumModalContext.Provider
      value={{
        open,
        setOpen,
        isSubscribed,
        setIsSubscribed,
        isTriggered,
        setIsTriggered,
        reason,
        setReason,
      }}
    >
      {children}
    </PremiumModalContext.Provider>
  );
}

// 4. Hook with error guard
export function usePremiumModal() {
  const context = useContext(PremiumModalContext);
  if (!context) {
    throw new Error("usePremiumModal must be used within PremiumModalProvider");
  }
  return context;
}
