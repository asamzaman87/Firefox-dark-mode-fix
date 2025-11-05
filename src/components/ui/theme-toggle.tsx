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
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="gpt:hover:scale-115 gpt:active:scale-105 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">
            {theme !== "light" ? <Moon /> : <Sun />}
            <span className="gpt:sr-only">Toggle theme</span>
        </Button>
    )
}
