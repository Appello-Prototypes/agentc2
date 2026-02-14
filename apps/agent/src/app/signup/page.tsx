import { SignUpForm } from "@/components/auth/sign-up-form";
import { AgentBrand } from "@/components/AgentBrand";
import { auth } from "@repo/auth";
import { prisma } from "@repo/database";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
    BotIcon,
    GitBranchIcon,
    NetworkIcon,
    PlugIcon,
    ShieldCheckIcon,
    CreditCardIcon
} from "lucide-react";

export const dynamic = "force-dynamic";

const PLATFORM_FEATURES = [
    {
        icon: BotIcon,
        title: "AI Agents",
        description: "Build agents that use tools, remember context, and take action"
    },
    {
        icon: GitBranchIcon,
        title: "Workflows",
        description: "Multi-step automations with logic, approvals, and branching"
    },
    {
        icon: NetworkIcon,
        title: "Agent Networks",
        description: "Orchestrate multiple agents to collaborate on complex tasks"
    },
    {
        icon: PlugIcon,
        title: "40+ Integrations",
        description: "HubSpot, Jira, Slack, GitHub, Gmail, and more via MCP"
    }
];

export default async function SignUpPage() {
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
        <div className="flex min-h-screen">
            {/* Left panel - Value proposition (hidden on mobile) */}
            <div className="hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
                <div>
                    <AgentBrand />
                </div>

                <div className="space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Your AI agent platform.
                            <br />
                            <span className="bg-linear-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                                Ready in minutes.
                            </span>
                        </h1>
                        <p className="max-w-md text-lg leading-relaxed text-slate-300">
                            Build, deploy, and orchestrate AI agents that connect to your tools and
                            automate real work.
                        </p>
                    </div>

                    {/* Feature list */}
                    <div className="grid gap-4">
                        {PLATFORM_FEATURES.map((feature) => (
                            <div key={feature.title} className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                                    <feature.icon className="size-4.5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        {feature.title}
                                    </p>
                                    <p className="text-sm leading-relaxed text-slate-400">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom trust bar */}
                <div className="space-y-4">
                    <div className="flex items-center gap-6 text-sm text-slate-400">
                        <span className="flex items-center gap-1.5">
                            <CreditCardIcon className="size-3.5" />
                            No credit card required
                        </span>
                        <span className="flex items-center gap-1.5">
                            <ShieldCheckIcon className="size-3.5" />
                            SOC 2 in progress
                        </span>
                    </div>
                </div>
            </div>

            {/* Right panel - Sign up form */}
            <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
                <div className="mx-auto w-full max-w-[420px]">
                    {/* Mobile-only brand */}
                    <div className="mb-8 flex items-center justify-center lg:hidden">
                        <AgentBrand />
                    </div>

                    {/* Free badge */}
                    <div className="mb-6 flex justify-center lg:justify-start">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
                            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                            100% Free to start
                        </span>
                    </div>

                    {/* Heading */}
                    <div className="mb-8 space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
                        <p className="text-muted-foreground text-sm">
                            Get started in under 2 minutes. No credit card needed.
                        </p>
                    </div>

                    {/* Sign up form */}
                    <SignUpForm />

                    {/* Trust footer */}
                    <div className="mt-8 space-y-4">
                        <div className="border-t pt-4">
                            <p className="text-muted-foreground text-center text-xs leading-relaxed">
                                By signing up, you agree to our{" "}
                                <a
                                    href="/terms"
                                    className="text-foreground underline underline-offset-2 hover:no-underline"
                                >
                                    Terms of Service
                                </a>{" "}
                                and{" "}
                                <a
                                    href="/privacy"
                                    className="text-foreground underline underline-offset-2 hover:no-underline"
                                >
                                    Privacy Policy
                                </a>
                            </p>
                        </div>

                        {/* What to expect */}
                        <div className="rounded-lg border border-dashed p-3 lg:hidden">
                            <p className="text-muted-foreground mb-2 text-xs font-medium">
                                What you&apos;ll get:
                            </p>
                            <ul className="text-muted-foreground space-y-1 text-xs">
                                <li className="flex items-center gap-2">
                                    <span className="text-emerald-500">&#10003;</span>
                                    AI agents with 40+ tool integrations
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-emerald-500">&#10003;</span>
                                    Workflows and agent networks
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-emerald-500">&#10003;</span>
                                    Built-in memory and RAG
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-emerald-500">&#10003;</span>
                                    Ready-to-use templates
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
