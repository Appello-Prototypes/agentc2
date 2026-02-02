import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Returns the API base path.
 * When running behind Caddy (catalyst.localhost), the basePath is "/agent".
 * When running standalone (localhost:3001), there's no basePath.
 */
export function getApiBase(): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    return appUrl.includes("catalyst.localhost") ? "/agent" : "";
}
