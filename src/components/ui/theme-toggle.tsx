import { Moon, Sun } from "lucide-react"

import { Theme, useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { useEffect } from "react"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()

    useEffect(() => {
        const gptrTheme = localStorage.getItem("gptr/next-theme") ?? "system";
        setTheme(gptrTheme as Theme);
        return () => {
            const theme = localStorage.getItem("theme") ?? "system";
            setTheme(theme as Theme)
        }
    }, []);

    const toggleTheme = () => {
        localStorage.setItem("gptr/next-theme", theme === "light" ? "dark" : "light")
        setTheme(theme === "light" ? "dark" : "light")
    }

    return (
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:scale-110  rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 [&_svg]:size-6 transition-all">
            {theme !== "light" ? <Moon /> : <Sun />}
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
