import { redirect } from "next/navigation";

// Redirect to the new top-level /mcp route for backward compatibility
export default function McpDemoPage() {
    redirect("/mcp");
}
