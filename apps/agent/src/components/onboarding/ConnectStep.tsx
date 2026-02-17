"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, Badge } from "@repo/ui";
import { CheckCircleIcon, Loader2Icon, AlertCircleIcon, ShieldCheckIcon } from "lucide-react";
import { SiGmail, SiGooglecalendar, SiGoogledrive } from "@icons-pack/react-simple-icons";
import { getApiBase } from "@/lib/utils";

/** Official Slack octothorpe logo (4-color) */
function SlackIcon({ size = 24 }: { size?: number }) {
    return (
        <svg
            role="img"
            viewBox="0 0 24 24"
            width={size}
            height={size}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
                fill="#E01E5A"
            />
            <path
                d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
                fill="#36C5F0"
            />
            <path
                d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.522-2.521V2.522A2.528 2.528 0 0 1 15.164 0a2.528 2.528 0 0 1 2.522 2.522v6.312z"
                fill="#2EB67D"
            />
            <path
                d="M15.164 18.956a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.164 24a2.528 2.528 0 0 1-2.522-2.522v-2.522h2.522zm0-1.27a2.528 2.528 0 0 1-2.522-2.522 2.528 2.528 0 0 1 2.522-2.522h6.314A2.528 2.528 0 0 1 24 15.164a2.528 2.528 0 0 1-2.522 2.522h-6.314z"
                fill="#ECB22E"
            />
        </svg>
    );
}

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
    const [slackIsOrgLevel, setSlackIsOrgLevel] = useState(false);

    // Check if the org already has Slack connected (e.g. user joining existing org)
    useEffect(() => {
        if (!organizationId) return;

        const checkExistingConnections = async () => {
            try {
                const base = getApiBase();
                const res = await fetch(`${base}/api/onboarding/integration-status`, {
                    credentials: "include"
                });
                const data = await res.json();
                if (data.success && data.integrations?.slack?.connected) {
                    setSlackConnected(true);
                    setSlackTeamName(data.integrations.slack.teamName || null);
                    setSlackIsOrgLevel(data.integrations.slack.isOrgLevel || false);
                }
            } catch (error) {
                console.error("[ConnectStep] Failed to check existing integrations:", error);
            }
        };

        checkExistingConnections();
    }, [organizationId]);

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
        // Guard: require organizationId and userId before starting OAuth
        if (!organizationId || !userId) {
            setSlackError("Your account is still loading. Please wait a moment and try again.");
            return;
        }

        setSlackConnecting(true);
        setSlackError(null);

        // Open Slack OAuth in a popup window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const base = getApiBase();
        const installUrl = `${base}/api/slack/install?organizationId=${encodeURIComponent(organizationId)}&userId=${encodeURIComponent(userId)}&mode=popup`;

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
        if (gmailConnected) {
            connected.push("gmail");
            connected.push("calendar");
            connected.push("drive");
        }
        if (slackConnected) connected.push("slack");
        onContinue(connected);
    }, [gmailConnected, slackConnected, onContinue]);

    // Google services auto-connected = 3 items (Gmail, Calendar, Drive)
    const googleCount = gmailConnected ? 3 : 0;
    const connectionCount = googleCount + (slackConnected ? 1 : 0);

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
                    {connectionCount >= 1 &&
                        connectionCount <= 3 &&
                        " Add Slack and your agent can work across tools."}
                    {connectionCount >= 4 && " Your agent is fully loaded and ready to go!"}
                </p>
            </div>

            <div className="mx-auto max-w-md space-y-3">
                {/* Google Services Group */}
                {gmailConnected && (
                    <div className="space-y-2">
                        <p className="text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase">
                            Google Account
                            {gmailAddress ? ` \u2014 ${gmailAddress}` : ""}
                        </p>

                        {/* Gmail */}
                        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                                    <SiGmail color="default" size={24} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">Gmail</p>
                                        <Badge
                                            variant="secondary"
                                            className="bg-green-100 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        >
                                            Connected
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        Read, search, draft, and send emails
                                    </p>
                                </div>
                                <CheckCircleIcon className="size-5 shrink-0 text-green-600 dark:text-green-400" />
                            </CardContent>
                        </Card>

                        {/* Calendar */}
                        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                                    <SiGooglecalendar color="default" size={24} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">Google Calendar</p>
                                        <Badge
                                            variant="secondary"
                                            className="bg-green-100 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        >
                                            Connected
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        Search events, check schedules, view attendees
                                    </p>
                                </div>
                                <CheckCircleIcon className="size-5 shrink-0 text-green-600 dark:text-green-400" />
                            </CardContent>
                        </Card>

                        {/* Google Drive */}
                        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                                    <SiGoogledrive color="default" size={24} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium">Google Drive</p>
                                        <Badge
                                            variant="secondary"
                                            className="bg-green-100 text-[10px] text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        >
                                            Connected
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        Search files, read docs, and create Google Docs
                                    </p>
                                </div>
                                <CheckCircleIcon className="size-5 shrink-0 text-green-600 dark:text-green-400" />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Gmail not connected — show single card prompting Google sign-in */}
                {!gmailConnected && (
                    <Card>
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                                <SiGmail color="default" size={24} />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">Gmail, Calendar &amp; Drive</p>
                                <p className="text-muted-foreground text-xs">
                                    Sign in with Google to unlock 8 tools instantly
                                </p>
                            </div>
                            <Badge
                                variant="outline"
                                className="text-muted-foreground shrink-0 text-[10px]"
                            >
                                Sign in with Google
                            </Badge>
                        </CardContent>
                    </Card>
                )}

                {/* Gmail partial scopes warning */}
                {!gmailConnected && gmailMissingScopes && gmailMissingScopes.length > 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                        <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="text-xs text-amber-700 dark:text-amber-300">
                            <p className="font-medium">Google needs additional permissions</p>
                            <p className="mt-0.5">
                                Your Google account was connected but some permissions weren&apos;t
                                granted. You can re-authorize from{" "}
                                <span className="font-medium">Settings &gt; Integrations</span>{" "}
                                anytime.
                            </p>
                        </div>
                    </div>
                )}

                {/* Slack Connection Card */}
                <div className="pt-1">
                    <p className="text-muted-foreground mb-2 px-1 text-xs font-medium tracking-wide uppercase">
                        Communication
                    </p>
                    <Card
                        className={
                            slackConnected
                                ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                                : ""
                        }
                    >
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                                <SlackIcon size={24} />
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
                                    {slackConnected && slackIsOrgLevel
                                        ? `Your team already connected ${slackTeamName || "Slack"}`
                                        : slackConnected
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
                </div>

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
                        <span className="font-medium">Your data stays secure.</span> Gmail lets your
                        agent read, search, and draft emails.{" "}
                        <span className="font-medium">It never sends without your approval.</span>{" "}
                        Calendar allows viewing and managing events. Drive allows searching,
                        reading, and creating docs. Slack is read-only for channels with write
                        access for bot messages. You can disconnect anytime from Settings.
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
