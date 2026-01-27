import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AgentHomePage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        // Use absolute URL to redirect to frontend login page
        // Relative paths don't work correctly with basePath: "/agent"
        redirect(process.env.NEXT_PUBLIC_APP_URL || "https://catalyst.localhost");
    }

    // Session is guaranteed to exist here due to redirect above
    return (
        <main className="container mx-auto p-8">
            <h1 className="mb-4 text-4xl font-bold">Catalyst Agent</h1>
            <div>
                <p className="mb-2 font-bold text-green-600">✓ Authenticated</p>
                <p>Welcome, {session.user.name}!</p>
                <p>Email: {session.user.email}</p>
            </div>
        </main>
    );
}
