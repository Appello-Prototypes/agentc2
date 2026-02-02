import { test as base, expect } from "@playwright/test";
import { TestPage } from "../pages/test.page";
import { RunsPage } from "../pages/runs.page";
import { TracesPage } from "../pages/traces.page";
import { WorkspacePage } from "../pages/workspace.page";

/**
 * Extended test fixture with page objects
 *
 * Provides pre-configured page objects for common test operations.
 * Authentication is handled by the setup project.
 */
export const test = base.extend<{
    testPage: TestPage;
    runsPage: RunsPage;
    tracesPage: TracesPage;
    workspacePage: WorkspacePage;
}>({
    testPage: async ({ page }, use) => {
        const testPage = new TestPage(page);
        await use(testPage);
    },
    runsPage: async ({ page }, use) => {
        const runsPage = new RunsPage(page);
        await use(runsPage);
    },
    tracesPage: async ({ page }, use) => {
        const tracesPage = new TracesPage(page);
        await use(tracesPage);
    },
    workspacePage: async ({ page }, use) => {
        const workspacePage = new WorkspacePage(page);
        await use(workspacePage);
    }
});

export { expect };
