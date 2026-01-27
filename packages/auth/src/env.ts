/**
 * Environment variable validation for authentication
 * Ensures required configuration is present at runtime
 */

export function validateAuthEnv() {
    const required = {
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        DATABASE_URL: process.env.DATABASE_URL
    } as const;

    const missing: string[] = [];

    for (const [key, value] of Object.entries(required)) {
        if (!value || value.trim() === "") {
            missing.push(key);
        }
    }

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables for authentication:\n${missing.map((key) => `  - ${key}`).join("\n")}\n\nPlease check your .env file.`
        );
    }

    // Validate NEXT_PUBLIC_APP_URL format if present
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl && appUrl.trim()) {
        try {
            new URL(appUrl);
        } catch {
            throw new Error(
                `Invalid NEXT_PUBLIC_APP_URL: "${appUrl}"\nMust be a valid URL (e.g., https://catalyst.localhost)`
            );
        }
    }
}

/**
 * Get app URL with fallback and validation
 */
export function getAppUrl(fallback = "http://localhost:3000"): string {
    const url = process.env.NEXT_PUBLIC_APP_URL?.trim() || fallback;

    try {
        new URL(url);
        return url;
    } catch {
        console.warn(`Invalid app URL: "${url}", using fallback: "${fallback}"`);
        return fallback;
    }
}
