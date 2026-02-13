import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Admin Login"
};

/**
 * Login has its own layout without the sidebar/header chrome.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <div className="flex min-h-dvh items-center justify-center">{children}</div>;
}
