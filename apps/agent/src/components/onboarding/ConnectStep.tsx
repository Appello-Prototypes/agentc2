"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, Badge } from "@repo/ui";
import {
    CheckCircleIcon,
    Loader2Icon,
    MailIcon,
    MessageSquareIcon,
    AlertCircleIcon,
    ShieldCheckIcon
} from "lucide-react";

interface ConnectStepProps {
    /** Whether Gmail was already connected during bootstrap */
    gmailConnected: boolean;
    gmailAddress?: string;
    /** If Gmail sync failed due to partial scopes */
    gmailMissingScopes?: string[];
    /** Organization ID needed for Slack OAuth */
    organizationId: string;
    /** Current user ID */
    userId: string;
    /** Called when user clicks Continue (or Skip) */
    onContinue: (connectedIntegrations: string[]) => void;
    onBack?: () => void;
}

export function ConnectStep({
    gmailConnected: initialGmailConnected,
    gmailAddress,
    gmailMissingScopes,
    organizationId,
    userId,
    onContinue,
    onBack
}: ConnectStepProps) {
    const [gmailConnected] = useState(initialGmailConnected);
    const [slackConnected, setSlackConnected] = useState(false);
    const [slackTeamName, setSlackTeamName] = useState<string | null>(null);
    const [slackConnecting, setSlackConnecting] = useState(false);
    const [slackError, setSlackError] = useState<string | null>(null);

    // Listen for Slack OAuth popup messages
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === "slack-oauth-success") {
                setSlackConnected(true);
                setSlackConnecting(false);
                setSlackError(null);
                setSlackTeamName(event.data.teamName || null);
            } else if (event.data?.type === "slack-oauth-error") {
                setSlackConnecting(false);
                const errorMsg = event.data.error || "Connection failed";
                // Detect Slack non-admin / access_denied errors
                if (errorMsg.includes("access_denied")) {
                    setSlackError(
                        "Your Slack workspace admin needs to approve this app. Ask them to install AgentC2, or skip for now."
                    );
                } else {
                    setSlackError(errorMsg);
                }
                console.error("[ConnectStep] Slack OAuth error:", errorMsg);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    const handleConnectSlack = useCallback(() => {
        setSlackConnecting(true);

        // Open Slack OAuth in a popup window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const installUrl = `/agent/api/slack/install?organizationId=${encodeURIComponent(organizationId)}&userId=${encodeURIComponent(userId)}&mode=popup`;

        const popup = window.open(
            installUrl,
            "slack-oauth",
            `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        // Handle popup being blocked or closed
        if (!popup) {
            setSlackConnecting(false);
            // Fallback: full-page redirect
            window.location.href = installUrl.replace("&mode=popup", "");
            return;
        }

        // Poll for popup close (user cancelled)
        const checkClosed = setInterval(() => {
            if (popup.closed) {
                clearInterval(checkClosed);
                setSlackConnecting(false);
            }
        }, 500);
    }, [organizationId, userId]);

    const handleContinue = useCallback(() => {
        const connected: string[] = [];
        if (gmailConnected) connected.push("gmail");
        if (slackConnected) connected.push("slack");
        onContinue(connected);
    }, [gmailConnected, slackConnected, onContinue]);

    const connectionCount = (gmailConnected ? 1 : 0) + (slackConnected ? 1 : 0);

    return (
        <div className="space-y-6">
            {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack} className="mb-2">
                    Back
                </Button>
            )}

            <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold tracking-tight">Power up your agent</h2>
                <p className="text-muted-foreground mx-auto max-w-lg text-sm">
                    Integrations unlock your agent&apos;s real abilities.
                    {connectionCount === 0 && " Connect at least one to see your agent in action."}
                    {connectionCount === 1 && " One more and your agent can work across tools."}
                    {connectionCount === 2 && " Great — your agent is ready to go!"}
                </p>
            </div>

            <div className="mx-auto max-w-md space-y-3">
                {/* Gmail Connection Card */}
                <Card
                    className={
                        gmailConnected
                            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                            : ""
                    }
                >
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                            <MailIcon className="size-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">Gmail</p>
                                {gmailConnected && (
                                    <Badge
                                        variant="secondary"
                                        className="bg-green-100 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    >
                                        Connected
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {gmailConnected
                                    ? gmailAddress
                                        ? `Reading email from ${gmailAddress}`
                                        : "Email access enabled"
                                    : "Read, search, and act on your email"}
                            </p>
                        </div>
                        {gmailConnected ? (
                            <CheckCircleIcon className="size-5 shrink-0 text-green-600 dark:text-green-400" />
                        ) : (
                            <Badge
                                variant="outline"
                                className="text-muted-foreground shrink-0 text-[10px]"
                            >
                                Sign in with Google
                            </Badge>
                        )}
                    </CardContent>
                </Card>

                {/* Gmail partial scopes warning */}
                {!gmailConnected && gmailMissingScopes && gmailMissingScopes.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                            <p className="font-medium">Gmail needs additional permissions</p>
                            <p className="mt-0.5">
                                Your Google account was connected but email permissions weren&apos;t
                                granted. You can re-authorize from{" "}
                                <span className="font-medium">Settings &gt; Integrations</span>{" "}
                                anytime.
                            </p>
                        </div>
                    </div>
                )}

                {/* Slack Connection Card */}
                <Card
                    className={
                        slackConnected
                            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                            : ""
                    }
                >
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                            <MessageSquareIcon className="size-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">Slack</p>
                                {slackConnected && (
                                    <Badge
                                        variant="secondary"
                                        className="bg-green-100 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    >
                                        Connected
                                    </Badge>
                                )}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {slackConnected
                                    ? `Connected to ${slackTeamName || "your workspace"}`
                                    : "Notifications, messaging, and team collaboration"}
                            </p>
                        </div>
                        {slackConnected ? (
                            <CheckCircleIcon className="size-5 shrink-0 text-green-600 dark:text-green-400" />
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleConnectSlack}
                                disabled={slackConnecting}
                            >
                                {slackConnecting ? (
                                    <Loader2Icon className="mr-1 size-3 animate-spin" />
                                ) : null}
                                {slackConnecting ? "Connecting..." : "Connect"}
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Slack error display */}
                {slackError && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-800 dark:bg-red-950/20">
                        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
                        <div className="text-xs text-red-700 dark:text-red-300">
                            <p>{slackError}</p>
                            <button
                                type="button"
                                className="mt-1 font-medium underline"
                                onClick={() => {
                                    setSlackError(null);
                                    handleConnectSlack();
                                }}
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Privacy and consent copy */}
            <div className="mx-auto max-w-md">
                <div className="flex items-start gap-2 rounded-lg p-2">
                    <ShieldCheckIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                        <span className="font-medium">Your data stays secure.</span> Gmail access
                        lets your agent read and search emails, and create drafts.{" "}
                        <span className="font-medium">It never sends without your approval.</span>{" "}
                        Slack is read-only for channels with write access for bot messages. You can
                        disconnect anytime from Settings.
                    </p>
                </div>
            </div>

            {/* CTA */}
            <div className="flex justify-center pt-2">
                <Button size="lg" className="px-10" onClick={handleContinue}>
                    {connectionCount > 0 ? "Continue" : "Skip for now"}
                </Button>
            </div>
        </div>
    );
}
