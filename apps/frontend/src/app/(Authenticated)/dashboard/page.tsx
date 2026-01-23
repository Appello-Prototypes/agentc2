import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { DashboardHeader } from "@/components/dashboard/header";
import { unauthorized } from "next/navigation";

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        return unauthorized();
    }

    return (
        <div className="min-h-screen">
            <DashboardHeader user={session.user} />

            <main className="container mx-auto p-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Welcome Back</CardTitle>
                            <CardDescription>
                                You&apos;re signed in as {session.user.email}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm">
                                This is your protected dashboard. Only authenticated users can see
                                this page.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
