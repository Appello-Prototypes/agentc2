"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    function cycleTheme() {
        if (theme === "light") setTheme("dark");
        else if (theme === "dark") setTheme("system");
        else setTheme("light");
    }

    return (
        <button
            onClick={cycleTheme}
            className="text-muted-foreground hover:text-foreground hover:bg-accent relative flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            title={`Theme: ${theme}`}
        >
            <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">Toggle theme</span>
        </button>
    );
}
