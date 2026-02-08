import { AgentBrand } from "@/components/AgentBrand";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (session) {
        const membership = await prisma.membership.findFirst({
            where: { userId: session.user.id },
            orderBy: { createdAt: "asc" }
        });

        if (membership?.onboardingCompletedAt) {
            redirect("/agents");
        }

        redirect("/onboarding");
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-6 flex items-center justify-center">
                    <AgentBrand />
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
