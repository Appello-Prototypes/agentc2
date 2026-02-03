import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Returns the API base path.
 * Agent app now serves at root without basePath, so this always returns empty string.
 * Kept for backward compatibility with existing code.
 */
export function getApiBase(): string {
    return "";
}
