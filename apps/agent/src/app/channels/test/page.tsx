"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Separator,
    Skeleton
} from "@repo/ui";
import {
    RefreshCwIcon,
    CheckCircle2Icon,
    XCircleIcon,
    MinusCircleIcon,
    PhoneIcon,
    MessageSquareIcon,
    MicIcon,
    SendIcon,
    LoaderIcon,
    SettingsIcon
} from "lucide-react";
import Link from "next/link";
import { getApiBase } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirror API response shapes)
// ---------------------------------------------------------------------------

interface CheckResult {
    name: string;
    status: "pass" | "fail" | "skip";
    message: string;
    durationMs: number;
    details?: unknown;
}

interface IntegrationResult {
    status: "pass" | "fail" | "skip";
    checks: CheckResult[];
    config: Record<string, string | boolean | null>;
    credentialSource?: "database" | "env_fallback" | "none";
}

interface DiagnosticsResult {
    timestamp: string;
    summary: { total: number; passed: number; failed: number; skipped: number };
    integrations: {
        twilio: IntegrationResult;
        elevenlabs: IntegrationResult;
        telegram: IntegrationResult;
        whatsapp: IntegrationResult;
    };
}

interface TestResponse {
    channel: string;
    dryRun: boolean;
    timestamp: string;
    checks: CheckResult[];
    summary: { total: number; passed: number; failed: number };
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: "pass" | "fail" | "skip" }) {
    switch (status) {
        case "pass":
            return <CheckCircle2Icon className="h-4 w-4 text-green-500" />;
        case "fail":
            return <XCircleIcon className="h-4 w-4 text-red-500" />;
        case "skip":
            return <MinusCircleIcon className="text-muted-foreground h-4 w-4" />;
    }
}

function StatusBadge({ status }: { status: "pass" | "fail" | "skip" }) {
    const variant = status === "pass" ? "default" : status === "fail" ? "destructive" : "secondary";
    return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
}

// ---------------------------------------------------------------------------
// Integration Card Component
// ---------------------------------------------------------------------------

interface IntegrationCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    channelKey: string;
    providerKey: string;
    result: IntegrationResult | null;
    loading: boolean;
    testFields: {
        label: string;
        key: string;
        placeholder: string;
    }[];
    onRunTest: (channel: string, params: Record<string, string>, dryRun: boolean) => void;
    testResult: TestResponse | null;
    testLoading: boolean;
    testError: string | null;
}

function CredentialSourceBadge({ source }: { source?: string }) {
    if (!source) return null;
    const label = source === "database" ? "DB" : source === "env_fallback" ? "ENV" : "None";
    const variant: "default" | "secondary" | "destructive" =
        source === "database" ? "default" : source === "env_fallback" ? "secondary" : "destructive";
    return (
        <Badge variant={variant} className="text-[10px]">
            {label}
        </Badge>
    );
}

function IntegrationCard({
    title,
    description,
    icon,
    channelKey,
    providerKey,
    result,
    loading,
    testFields,
    onRunTest,
    testResult,
    testLoading,
    testError
}: IntegrationCardProps) {
    const [testParams, setTestParams] = useState<Record<string, string>>({});

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                            {icon}
                        </div>
                        <div>
                            <CardTitle className="text-lg">{title}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {loading ? (
                            <Skeleton className="h-6 w-16" />
                        ) : result ? (
                            <>
                                <CredentialSourceBadge source={result.credentialSource} />
                                <StatusBadge status={result.status} />
                            </>
                        ) : null}
                        <Link href={`/mcp/providers/${providerKey}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <SettingsIcon className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Config Section */}
                {result && Object.keys(result.config).length > 0 && (
                    <div>
                        <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                            Configuration
                        </h4>
                        <div className="bg-muted/50 space-y-1 rounded-md p-3 font-mono text-xs">
                            {Object.entries(result.config).map(([key, value]) => (
                                <div key={key} className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">{key}</span>
                                    <span className="truncate">
                                        {value === null ? (
                                            <span className="text-muted-foreground italic">
                                                not set
                                            </span>
                                        ) : typeof value === "boolean" ? (
                                            value ? (
                                                "true"
                                            ) : (
                                                "false"
                                            )
                                        ) : (
                                            String(value)
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Health Checks */}
                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : result ? (
                    <div>
                        <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                            Health Checks
                        </h4>
                        <div className="space-y-1">
                            {result.checks.map((check, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
                                >
                                    <StatusIcon status={check.status} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{check.name}</span>
                                            {check.durationMs > 0 && (
                                                <span className="text-muted-foreground text-xs">
                                                    {check.durationMs}ms
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground text-xs">
                                            {check.message}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                <Separator />

                {/* E2E Test Section */}
                <div>
                    <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                        End-to-End Tests
                    </h4>
                    <div className="space-y-3">
                        {testFields.map((field) => (
                            <div key={field.key}>
                                <label className="text-muted-foreground mb-1 block text-xs">
                                    {field.label}
                                </label>
                                <Input
                                    placeholder={field.placeholder}
                                    value={testParams[field.key] || ""}
                                    onChange={(e) =>
                                        setTestParams((prev) => ({
                                            ...prev,
                                            [field.key]: e.target.value
                                        }))
                                    }
                                    className="text-sm"
                                />
                            </div>
                        ))}
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={testLoading}
                                onClick={() => onRunTest(channelKey, testParams, true)}
                            >
                                {testLoading ? (
                                    <LoaderIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <RefreshCwIcon className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Dry Run
                            </Button>
                            <Button
                                size="sm"
                                disabled={testLoading}
                                onClick={() => onRunTest(channelKey, testParams, false)}
                            >
                                {testLoading ? (
                                    <LoaderIcon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <SendIcon className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Run E2E Test
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Test Error */}
                {testError && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                        {testError}
                    </div>
                )}

                {/* Test Results */}
                {testResult && (
                    <div>
                        <h4 className="text-muted-foreground mb-2 text-xs font-medium tracking-wider uppercase">
                            Test Results{" "}
                            <span className="text-muted-foreground font-normal normal-case">
                                ({testResult.dryRun ? "dry run" : "live"})
                            </span>
                        </h4>
                        <div className="space-y-1">
                            {testResult.checks.map((check, i) => (
                                <div
                                    key={i}
                                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
                                >
                                    <StatusIcon status={check.status} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{check.name}</span>
                                            {check.durationMs > 0 && (
                                                <span className="text-muted-foreground text-xs">
                                                    {check.durationMs}ms
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-muted-foreground text-xs">
                                            {check.message}
                                        </p>
                                        {check.details != null && (
                                            <details className="mt-1">
                                                <summary className="text-muted-foreground cursor-pointer text-xs hover:underline">
                                                    Show details
                                                </summary>
                                                <pre className="bg-muted mt-1 max-h-40 overflow-auto rounded p-2 text-xs">
                                                    {JSON.stringify(
                                                        check.details as Record<string, unknown>,
                                                        null,
                                                        2
                                                    )}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="text-muted-foreground mt-2 text-xs">
                            {testResult.summary.passed}/{testResult.summary.total} passed at{" "}
                            {new Date(testResult.timestamp).toLocaleTimeString()}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ChannelTestPage() {
    const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, TestResponse | null>>({});
    const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});
    const [testErrors, setTestErrors] = useState<Record<string, string | null>>({});

    const apiBase = getApiBase();

    const fetchDiagnostics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/api/channels/diagnostics`);
            if (res.ok) {
                const data = await res.json();
                setDiagnostics(data);
            } else {
                const body = await res.json().catch(() => null);
                setError(body?.error || `Diagnostics API returned ${res.status}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to connect to diagnostics API");
        } finally {
            setLoading(false);
        }
    }, [apiBase]);

    useEffect(() => {
        fetchDiagnostics();
    }, [fetchDiagnostics]);

    const handleRunTest = useCallback(
        async (channel: string, params: Record<string, string>, dryRun: boolean) => {
            setTestLoading((prev) => ({ ...prev, [channel]: true }));
            setTestErrors((prev) => ({ ...prev, [channel]: null }));
            try {
                const body: Record<string, unknown> = { dryRun };

                // Map params to the correct body fields
                if (channel === "twilio" && params.testPhoneNumber) {
                    body.testPhoneNumber = params.testPhoneNumber;
                }
                if (channel === "elevenlabs" && params.testText) {
                    body.testText = params.testText;
                }
                if (channel === "telegram" && params.testChatId) {
                    body.testChatId = params.testChatId;
                }
                if (channel === "whatsapp" && params.testNumber) {
                    body.testNumber = params.testNumber;
                }

                const res = await fetch(`${apiBase}/api/channels/test/${channel}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });

                if (res.ok) {
                    const data = await res.json();
                    setTestResults((prev) => ({ ...prev, [channel]: data }));
                } else {
                    const errBody = await res.json().catch(() => null);
                    setTestErrors((prev) => ({
                        ...prev,
                        [channel]: errBody?.error || `Test API returned ${res.status}`
                    }));
                }
            } catch (err) {
                setTestErrors((prev) => ({
                    ...prev,
                    [channel]: err instanceof Error ? err.message : "Test request failed"
                }));
            } finally {
                setTestLoading((prev) => ({ ...prev, [channel]: false }));
            }
        },
        [apiBase]
    );

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Channel Diagnostics</h1>
                    <p className="text-muted-foreground text-sm">
                        Test and validate all voice and messaging integrations
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {diagnostics && (
                        <div className="text-muted-foreground text-sm">
                            <span className="font-medium text-green-500">
                                {diagnostics.summary.passed}
                            </span>{" "}
                            passed{" / "}
                            <span className="font-medium text-red-500">
                                {diagnostics.summary.failed}
                            </span>{" "}
                            failed{" / "}
                            <span className="font-medium">{diagnostics.summary.skipped}</span>{" "}
                            skipped
                        </div>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchDiagnostics}
                        disabled={loading}
                    >
                        <RefreshCwIcon
                            className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                        />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                    <span className="font-medium">Diagnostics Error: </span>
                    {error}
                </div>
            )}

            {/* Integration Cards Grid */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Twilio (Voice) */}
                <IntegrationCard
                    title="Twilio Voice"
                    description="Phone call integration with speech recognition and TTS"
                    icon={<PhoneIcon className="h-5 w-5" />}
                    channelKey="twilio"
                    providerKey="twilio-voice"
                    result={diagnostics?.integrations.twilio ?? null}
                    loading={loading}
                    testFields={[
                        {
                            label: "Test Phone Number (for live call test)",
                            key: "testPhoneNumber",
                            placeholder: "+15551234567"
                        }
                    ]}
                    onRunTest={handleRunTest}
                    testResult={testResults.twilio ?? null}
                    testLoading={testLoading.twilio ?? false}
                    testError={testErrors.twilio ?? null}
                />

                {/* ElevenLabs */}
                <IntegrationCard
                    title="ElevenLabs"
                    description="Conversational AI agents, premium TTS, and webhook tools"
                    icon={<MicIcon className="h-5 w-5" />}
                    channelKey="elevenlabs"
                    providerKey="elevenlabs"
                    result={diagnostics?.integrations.elevenlabs ?? null}
                    loading={loading}
                    testFields={[
                        {
                            label: "Test Text (for TTS generation)",
                            key: "testText",
                            placeholder: "Hello, this is a test."
                        }
                    ]}
                    onRunTest={handleRunTest}
                    testResult={testResults.elevenlabs ?? null}
                    testLoading={testLoading.elevenlabs ?? false}
                    testError={testErrors.elevenlabs ?? null}
                />

                {/* Telegram */}
                <IntegrationCard
                    title="Telegram"
                    description="Telegram Bot API for messaging and group chat"
                    icon={<MessageSquareIcon className="h-5 w-5" />}
                    channelKey="telegram"
                    providerKey="telegram-bot"
                    result={diagnostics?.integrations.telegram ?? null}
                    loading={loading}
                    testFields={[
                        {
                            label: "Test Chat ID (for sending test message)",
                            key: "testChatId",
                            placeholder: "123456789"
                        }
                    ]}
                    onRunTest={handleRunTest}
                    testResult={testResults.telegram ?? null}
                    testLoading={testLoading.telegram ?? false}
                    testError={testErrors.telegram ?? null}
                />

                {/* WhatsApp */}
                <IntegrationCard
                    title="WhatsApp"
                    description="WhatsApp Web integration via Baileys (QR code pairing)"
                    icon={<MessageSquareIcon className="h-5 w-5" />}
                    channelKey="whatsapp"
                    providerKey="whatsapp-web"
                    result={diagnostics?.integrations.whatsapp ?? null}
                    loading={loading}
                    testFields={[
                        {
                            label: "Test Phone Number (must be on allowlist)",
                            key: "testNumber",
                            placeholder: "+15551234567"
                        }
                    ]}
                    onRunTest={handleRunTest}
                    testResult={testResults.whatsapp ?? null}
                    testLoading={testLoading.whatsapp ?? false}
                    testError={testErrors.whatsapp ?? null}
                />
            </div>

            {/* Timestamp */}
            {diagnostics && (
                <p className="text-muted-foreground text-center text-xs">
                    Last checked: {new Date(diagnostics.timestamp).toLocaleString()}
                </p>
            )}
        </div>
    );
}
