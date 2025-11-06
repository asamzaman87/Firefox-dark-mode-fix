import { Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
    }

    return (
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="gpt:hover:scale-115 gpt:active:scale-105 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">
            {theme !== "light" ? <Moon /> : <Sun />}
            <span className="gpt:sr-only">Toggle theme</span>
        </Button>
    )
}
