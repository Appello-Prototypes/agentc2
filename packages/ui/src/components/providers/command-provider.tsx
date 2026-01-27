"use client";

import * as React from "react";

type CommandContextProps = {
    open: boolean;
    setOpen: (open: boolean) => void;
    toggleCommand: () => void;
    router: {
        push: (path: string) => void;
    };
    pathname: string;
};

const CommandContext = React.createContext<CommandContextProps | undefined>(undefined);

interface CommandProviderProps {
    children: React.ReactNode;
    router: {
        push: (path: string) => void;
    };
    pathname: string;
}

export function CommandProvider({ children, router, pathname }: CommandProviderProps) {
    const [open, setOpen] = React.useState(false);

    const toggleCommand = React.useCallback(() => {
        setOpen((prev) => !prev);
    }, []);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                toggleCommand();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [toggleCommand]);

    const value = React.useMemo(
        () => ({
            open,
            setOpen,
            toggleCommand,
            router,
            pathname
        }),
        [open, toggleCommand, router, pathname]
    );

    return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export function useCommand() {
    const context = React.useContext(CommandContext);
    if (context === undefined) {
        throw new Error("useCommand must be used within a CommandProvider");
    }
    return context;
}
