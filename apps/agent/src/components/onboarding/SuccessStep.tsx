"use client";

import Link from "next/link";
import { Button, Card, CardContent } from "@repo/ui";

interface SuccessStepProps {
    agentName: string;
    agentSlug: string;
    onFinish: () => void;
}

export function SuccessStep({ agentName, agentSlug, onFinish }: SuccessStepProps) {
    return (
        <Card className="border-0 shadow-none">
            <CardContent className="space-y-8 py-12 text-center">
                {/* Success icon */}
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
                    ✓
                </div>

                {/* Message */}
                <div className="space-y-3">
                    <h1 className="text-3xl font-bold">You&apos;re all set!</h1>
                    <p className="text-muted-foreground mx-auto max-w-md text-lg">
                        Your agent &quot;{agentName}&quot; is ready to use.
                    </p>
                </div>

                {/* Next steps */}
                <div className="mx-auto max-w-md space-y-4 text-left">
                    <p className="font-medium">What&apos;s next?</p>
                    <div className="space-y-3">
                        <Link
                            href={`/workspace/${agentSlug}/overview`}
                            className="hover:bg-muted block rounded-lg border p-4 transition-colors"
                        >
                            <p className="font-medium">View your agent</p>
                            <p className="text-muted-foreground text-sm">
                                Monitor runs, analytics, and performance
                            </p>
                        </Link>
                        <Link
                            href="/workflows"
                            className="hover:bg-muted block rounded-lg border p-4 transition-colors"
                        >
                            <p className="font-medium">Create a workflow</p>
                            <p className="text-muted-foreground text-sm">
                                Chain multiple steps with logic and approvals
                            </p>
                        </Link>
                        <Link
                            href="/networks"
                            className="hover:bg-muted block rounded-lg border p-4 transition-colors"
                        >
                            <p className="font-medium">Build a network</p>
                            <p className="text-muted-foreground text-sm">
                                Let AI decide which agents to use
                            </p>
                        </Link>
                    </div>
                </div>

                {/* CTA */}
                <Button size="lg" className="px-8" onClick={onFinish}>
                    Go to Workspace
                </Button>
            </CardContent>
        </Card>
    );
}
