import { Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeToggle({ menuMode = false }: { menuMode?: boolean }) {
    const { theme, setTheme } = useTheme()

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
    }

    if (menuMode) {
        return (
            <Button variant="ghost" onClick={toggleTheme} className="gpt:w-full gpt:justify-start gpt:gap-2 gpt:px-3 gpt:rounded-md hover:gpt:bg-gray-100 gpt:dark:hover:bg-gray-700 gpt:[&_svg]:size-4">
                {theme !== "light" ? <Moon /> : <Sun />}
                {theme !== "light" ? "Light Mode" : "Dark Mode"}
            </Button>
        )
    }

    return (
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:gpt:scale-115 active:gpt:scale-105 gpt:rounded-full gpt:border gpt:border-gray-200 gpt:dark:border-gray-700 gpt:bg-gray-50 gpt:dark:bg-gray-800 gpt:[&_svg]:size-6 gpt:transition-all">
            {theme !== "light" ? <Moon /> : <Sun />}
            <span className="gpt:sr-only">Toggle theme</span>
        </Button>
    )
}
