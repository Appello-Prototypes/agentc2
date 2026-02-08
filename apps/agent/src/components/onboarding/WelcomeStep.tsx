"use client";

import { Button, Card, CardContent } from "@repo/ui";

interface WelcomeStepProps {
    onContinue: () => void;
    onAiSetup: () => void;
}

export function WelcomeStep({ onContinue, onAiSetup }: WelcomeStepProps) {
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
                        Tell us when something happens and the outcome you want. We will build the
                        system for you.
                    </p>
                </div>

                {/* Value props */}
                <div className="mx-auto grid max-w-lg gap-4 text-left">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            1
                        </div>
                        <div>
                            <p className="font-medium">Describe the trigger</p>
                            <p className="text-muted-foreground text-sm">
                                Event, schedule, or on-demand
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            2
                        </div>
                        <div>
                            <p className="font-medium">Describe the outcome</p>
                            <p className="text-muted-foreground text-sm">
                                Review, analyze, act, notify, or chain steps
                            </p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            3
                        </div>
                        <div>
                            <p className="font-medium">We build and monitor</p>
                            <p className="text-muted-foreground text-sm">
                                You get results and live performance visibility
                            </p>
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <div className="flex flex-col items-center gap-3">
                    <Button size="lg" className="px-8" onClick={onAiSetup}>
                        Set up with Workspace AI
                    </Button>
                    <Button variant="outline" size="sm" onClick={onContinue}>
                        Advanced setup
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
