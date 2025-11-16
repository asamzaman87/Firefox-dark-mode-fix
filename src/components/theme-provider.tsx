import { THEME_STORAGE_KEY } from "@/lib/constants"
import { createContext, useContext, useEffect, useState } from "react"

export type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useEffect(() => {
    const root = document.documentElement;
    let isApplying = false; // Flag to prevent recursive loops
    
    const applyTheme = () => {
      const isActive = localStorage.getItem('gptr/active') === 'true';
      
      if (!isActive || isApplying) {
        return;
      }
      
      // Determine the actual theme to apply
      let targetTheme: "light" | "dark";
      if (theme === "system") {
        targetTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light"
      } else {
        targetTheme = theme;
      }
      
      // Check if already correctly applied
      const hasLight = root.classList.contains("light");
      const hasDark = root.classList.contains("dark");
      const currentColorScheme = root.style.colorScheme;
      
      const isCorrectlyApplied = 
        (targetTheme === "light" && hasLight && currentColorScheme === "light") ||
        (targetTheme === "dark" && hasDark && currentColorScheme === "dark");
      
      if (isCorrectlyApplied) {
        return;
      }

      // Apply the theme
      isApplying = true;
      root.classList.remove("light", "dark")
      root.classList.add(targetTheme)
      root.style["colorScheme"] = targetTheme
      // Use requestAnimationFrame to reset flag after DOM update
      requestAnimationFrame(() => {
        isApplying = false;
      });
    };
    
    // Apply theme immediately when theme state changes
    applyTheme();
    
    // Watch for classList changes (when ChatGPT tries to revert our theme)
    const classObserver = new MutationObserver(() => {
      // Only reapply if we detect the theme was changed away from what we want
      const isActive = localStorage.getItem('gptr/active') === 'true';
      if (isActive && !isApplying) {
        const hasLight = root.classList.contains("light");
        const hasDark = root.classList.contains("dark");
        let targetTheme: "light" | "dark";
        if (theme === "system") {
          targetTheme = window.matchMedia("(prefers-color-scheme: dark)")
            .matches ? "dark" : "light"
        } else {
          targetTheme = theme;
        }
        
        const shouldHaveLight = targetTheme === "light";
        const shouldHaveDark = targetTheme === "dark";
        
        // If ChatGPT changed it to something different, reapply
        if ((shouldHaveLight && !hasLight) || (shouldHaveDark && !hasDark)) {
          applyTheme();
        }
      }
    });
    
    classObserver.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });
    
    // Listen for storage changes (when extension becomes active) - only from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gptr/active') {
        applyTheme();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      classObserver.disconnect();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
