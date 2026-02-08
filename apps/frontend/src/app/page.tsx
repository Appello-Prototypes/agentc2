import { SignInForm } from "@/components/auth/sign-in-form";
import { AgentC2Logo, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { auth } from "@repo/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export default async function HomePage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (session) {
        redirect("/dashboard");
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-6 flex items-center justify-center gap-2">
                    <AgentC2Logo size={28} />
                    <span className="text-lg font-semibold">AgentC2</span>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Welcome Back</CardTitle>
                        <CardDescription>Sign in to your account to continue</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SignInForm />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
