import { test as setup, expect } from "@playwright/test";

const authFile = ".auth/user.json";

/**
 * Authentication Setup
 *
 * This runs before all tests to authenticate and save the session state.
 * Subsequent tests will reuse this saved state to avoid logging in repeatedly.
 */
setup("authenticate", async ({ page }) => {
    // Get credentials from environment variables
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;

    if (!email || !password) {
        throw new Error(
            "TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables are required. " +
                "Add them to your .env file."
        );
    }

    // Navigate to the login page
    await page.goto("/");

    // Fill in the login form
    await page.fill("#email", email);
    await page.fill("#password", password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for successful login - should redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 30000 });

    // Verify we're logged in by checking for dashboard content
    await expect(page.locator("body")).toBeVisible();

    // Save the authentication state
    await page.context().storageState({ path: authFile });

    console.log("Authentication successful, state saved to", authFile);
});
