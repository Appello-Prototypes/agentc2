import { AgentBrand } from "@/components/AgentBrand";
import { SignInForm } from "@/components/auth/sign-in-form";
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
            redirect("/workspace");
        }

        redirect("/onboarding");
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4">
            <div className="mx-auto w-full max-w-[420px]">
                <div className="mb-8 flex items-center justify-center">
                    <AgentBrand />
                </div>

                <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
                    <p className="text-muted-foreground text-sm">
                        Sign in to your account to continue
                    </p>
                </div>

                <div className="mt-8">
                    <SignInForm />
                </div>
            </div>
        </div>
    );
}
