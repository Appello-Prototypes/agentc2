"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Sun01Icon, Moon01Icon, ComputerDesk01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from "@repo/ui";

const themeOptions = [
    {
        value: "light",
        label: "Light",
        description: "A clean, bright interface",
        icon: Sun01Icon
    },
    {
        value: "dark",
        label: "Dark",
        description: "Easy on the eyes, great for focus",
        icon: Moon01Icon
    },
    {
        value: "system",
        label: "System",
        description: "Follows your operating system preference",
        icon: ComputerDesk01Icon
    }
] as const;

const emptySubscribe = () => () => {};
function useIsMounted() {
    return useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );
}

export default function AppearanceSettingsPage() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const mounted = useIsMounted();

    if (!mounted) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Appearance</h1>
                    <p className="text-muted-foreground">
                        Customize the look and feel of the application
                    </p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Theme</CardTitle>
                        <CardDescription>Select your preferred color scheme</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-3">
                            {themeOptions.map((option) => (
                                <div
                                    key={option.value}
                                    className="bg-muted/50 h-28 animate-pulse rounded-lg"
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Appearance</h1>
                <p className="text-muted-foreground">
                    Customize the look and feel of the application
                </p>
            </div>

            {/* Theme Selection */}
            <Card>
                <CardHeader>
                    <CardTitle>Theme</CardTitle>
                    <CardDescription>
                        Select your preferred color scheme. Your preference is saved automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {themeOptions.map((option) => {
                            const isSelected = theme === option.value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setTheme(option.value)}
                                    className={cn(
                                        "flex flex-col items-center gap-3 rounded-lg border-2 p-5 transition-all",
                                        "hover:bg-accent/50",
                                        isSelected
                                            ? "border-primary bg-accent/30"
                                            : "bg-muted/30 border-transparent"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "flex size-12 items-center justify-center rounded-full transition-colors",
                                            isSelected
                                                ? "bg-primary/15 text-primary"
                                                : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        <HugeiconsIcon
                                            icon={option.icon}
                                            className="size-6"
                                            strokeWidth={1.5}
                                        />
                                    </div>
                                    <div className="text-center">
                                        <p
                                            className={cn(
                                                "text-sm font-medium",
                                                isSelected && "text-primary"
                                            )}
                                        >
                                            {option.label}
                                        </p>
                                        <p className="text-muted-foreground mt-0.5 text-xs">
                                            {option.description}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Current resolved theme indicator */}
                    <p className="text-muted-foreground mt-4 text-xs">
                        Currently using{" "}
                        <span className="font-medium">
                            {resolvedTheme === "dark" ? "dark" : "light"}
                        </span>{" "}
                        mode
                        {theme === "system" && " (based on your system settings)"}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
