"use client";

import * as React from "react";
import { ThemeProvider } from "./theme-provider";
import { SessionProvider } from "@repo/auth/providers";
import { CommandProvider } from "./command-provider";
import { SidebarProvider } from "../sidebar";
import type { ComponentProps } from "react";

type AppProvidersProps = {
    children: React.ReactNode;
    /**
     * Props to pass to ThemeProvider
     * @default { attribute: "class", defaultTheme: "system", enableSystem: true, disableTransitionOnChange: true }
     */
    themeProps?: ComponentProps<typeof ThemeProvider>;
    /**
     * Whether to include the SidebarProvider
     * @default false
     */
    withSidebar?: boolean;
    /**
     * Router instance for navigation (required for CommandPalette)
     */
    router: {
        push: (path: string) => void;
    };
    /**
     * Current pathname (required for CommandPalette)
     */
    pathname: string;
};

/**
 * Shared provider component that wraps all base application providers.
 *
 * Includes:
 * - ThemeProvider (dark mode, theme management)
 * - SessionProvider (Better Auth session management)
 * - CommandProvider (command palette state)
 * - SidebarProvider (optional, for layouts with sidebar)
 *
 * @example
 * // Basic usage (root layout)
 * <AppProviders>{children}</AppProviders>
 *
 * @example
 * // With custom theme props
 * <AppProviders themeProps={{ defaultTheme: "dark" }}>{children}</AppProviders>
 *
 * @example
 * // With sidebar (authenticated layouts)
 * <AppProviders withSidebar>{children}</AppProviders>
 */
export function AppProviders({
    children,
    themeProps = {
        attribute: "class",
        defaultTheme: "system",
        enableSystem: true,
        disableTransitionOnChange: true
    },
    withSidebar = false,
    router,
    pathname
}: AppProvidersProps) {
    const content = (
        <ThemeProvider {...themeProps}>
            <SessionProvider>
                <CommandProvider router={router} pathname={pathname}>
                    {children}
                </CommandProvider>
            </SessionProvider>
        </ThemeProvider>
    );

    if (withSidebar) {
        return <SidebarProvider>{content}</SidebarProvider>;
    }

    return content;
}
