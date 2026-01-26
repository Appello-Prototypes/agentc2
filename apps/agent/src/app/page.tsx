import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AgentHomePage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect("/");
    }

    return (
        <main className="container mx-auto p-8">
            <h1 className="mb-4 text-4xl font-bold">Catalyst Agent</h1>
            {session ? (
                <div>
                    <p className="mb-2 font-bold text-green-600">✓ Authenticated</p>
                    <p>Welcome, {session.user.name}!</p>
                    <p>Email: {session.user.email}</p>
                </div>
            ) : (
                <p>
                    Please{" "}
                    <Link href="/" className="text-blue-600">
                        sign in
                    </Link>{" "}
                    to continue.
                </p>
            )}
        </main>
    );
}
