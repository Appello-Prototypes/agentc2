import { redirect } from "next/navigation";

/**
 * Root page — redirects to the workspace.
 *
 * In production, Caddy routes the root URL (/) to the frontend app which
 * serves the public landing page. This redirect only fires when the agent
 * app is accessed directly (e.g. localhost:3001 in development).
 */
export default function RootPage() {
    redirect("/workspace");
}
