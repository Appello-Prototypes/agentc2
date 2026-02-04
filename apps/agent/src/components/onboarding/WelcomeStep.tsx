"use client";

import { Button, Card, CardContent } from "@repo/ui";

interface WelcomeStepProps {
    onContinue: () => void;
}

export function WelcomeStep({ onContinue }: WelcomeStepProps) {
    return (
        <Card className="border-0 shadow-none">
            <CardContent className="space-y-8 py-12 text-center">
                {/* Logo / Icon */}
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-4xl text-white shadow-lg">
                    C2
                </div>

                {/* Headline */}
                <div className="space-y-3">
                    <h1 className="text-4xl font-bold tracking-tight">Welcome to AgentC2</h1>
                    <p className="text-muted-foreground mx-auto max-w-md text-lg">
                        Build AI agents that learn and improve over time. Let&apos;s create your
                        first agent in under 2 minutes.
                    </p>
                </div>

                {/* Value props */}
                <div className="mx-auto grid max-w-lg gap-4 text-left">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            1
                        </div>
                        <div>
                            <p className="font-medium">Choose a template or start fresh</p>
                            <p className="text-muted-foreground text-sm">
                                Pre-built agents for common use cases
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            2
                        </div>
                        <div>
                            <p className="font-medium">Configure and test</p>
                            <p className="text-muted-foreground text-sm">
                                Customize instructions and try it out
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            3
                        </div>
                        <div>
                            <p className="font-medium">Deploy and improve</p>
                            <p className="text-muted-foreground text-sm">
                                Your agent learns from every interaction
                            </p>
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <Button size="lg" className="px-8" onClick={onContinue}>
                    Get Started
                </Button>
            </CardContent>
        </Card>
    );
}
