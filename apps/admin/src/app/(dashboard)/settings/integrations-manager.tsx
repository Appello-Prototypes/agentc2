"use client";

import { useCallback, useEffect, useState } from "react";

type IntegrationStatus = {
    configured: boolean;
    configuredAt: string | null;
    configuredBy: string | null;
    fields: Record<string, unknown>;
    metadata: Record<string, unknown>;
};

type FieldDef = {
    key: string;
    label: string;
    type: "text" | "password";
    placeholder: string;
    required: boolean;
    help?: string;
};

type IntegrationDef = {
    id: string;
    name: string;
    description: string;
    color: string;
    fields: FieldDef[];
    docsUrl?: string;
};

const INTEGRATIONS: IntegrationDef[] = [
    {
        id: "slack",
        name: "Slack",
        description: "Admin notifications, system alerts, and support ticket updates.",
        color: "text-[#4A154B]",
        fields: [
            {
                key: "botToken",
                label: "Bot Token",
                type: "password",
                placeholder: "xoxb-...",
                required: true,
                help: "Bot User OAuth Token from your Slack app"
            },
            {
                key: "signingSecret",
                label: "Signing Secret",
                type: "password",
                placeholder: "Signing secret",
                required: true,
                help: "Found under Basic Information in your Slack app"
            },
            {
                key: "clientId",
                label: "Client ID",
                type: "text",
                placeholder: "Client ID",
                required: false,
                help: "OAuth client ID for workspace installations"
            },
            {
                key: "clientSecret",
                label: "Client Secret",
                type: "password",
                placeholder: "Client secret",
                required: false
            },
            {
                key: "alertChannelId",
                label: "Alert Channel ID",
                type: "text",
                placeholder: "C0123456789",
                required: false,
                help: "Channel ID for admin alert messages"
            }
        ],
        docsUrl: "https://api.slack.com/apps"
    },
    {
        id: "email",
        name: "Email (Resend)",
        description: "Transactional emails for invites, notifications, and alerts.",
        color: "text-black",
        fields: [
            {
                key: "apiKey",
                label: "API Key",
                type: "password",
                placeholder: "re_...",
                required: true,
                help: "Resend API key"
            },
            {
                key: "fromEmail",
                label: "From Email",
                type: "text",
                placeholder: "noreply@yourdomain.com",
                required: true,
                help: "Verified sender email address"
            },
            {
                key: "replyToEmail",
                label: "Reply-To Email",
                type: "text",
                placeholder: "support@yourdomain.com",
                required: false,
                help: "Default reply-to address"
            }
        ],
        docsUrl: "https://resend.com/docs"
    },
    {
        id: "stripe",
        name: "Stripe",
        description: "Payment processing, subscriptions, and billing management.",
        color: "text-[#635BFF]",
        fields: [
            {
                key: "secretKey",
                label: "Secret Key",
                type: "password",
                placeholder: "sk_live_... or sk_test_...",
                required: true,
                help: "Stripe secret key (test or live)"
            },
            {
                key: "webhookSecret",
                label: "Webhook Signing Secret",
                type: "password",
                placeholder: "whsec_...",
                required: true,
                help: "Webhook endpoint signing secret"
            },
            {
                key: "publishableKey",
                label: "Publishable Key",
                type: "text",
                placeholder: "pk_live_... or pk_test_...",
                required: false,
                help: "Public key for client-side Stripe.js"
            }
        ],
        docsUrl: "https://dashboard.stripe.com/apikeys"
    },
    {
        id: "inngest",
        name: "Inngest",
        description: "Background job processing and event-driven workflows.",
        color: "text-[#5D5FEF]",
        fields: [
            {
                key: "eventKey",
                label: "Event Key",
                type: "password",
                placeholder: "Event key",
                required: true,
                help: "Key for publishing events"
            },
            {
                key: "signingKey",
                label: "Signing Key",
                type: "password",
                placeholder: "signkey-...",
                required: true,
                help: "Key for webhook verification"
            }
        ],
        docsUrl: "https://www.inngest.com/docs"
    }
];

function SlackIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.312z" />
        </svg>
    );
}

function EmailIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
    );
}

function StripeIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
        </svg>
    );
}

function InngestIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M4 4h16v2H4V4zm0 7h16v2H4v-2zm0 7h10v2H4v-2z" />
        </svg>
    );
}

const ICONS: Record<string, () => React.ReactElement> = {
    slack: SlackIcon,
    email: EmailIcon,
    stripe: StripeIcon,
    inngest: InngestIcon
};

export function IntegrationsManager() {
    const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>({});
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
        null
    );

    const loadStatuses = useCallback(async () => {
        try {
            const res = await fetch("/admin/api/settings/integrations/status", {
                credentials: "include"
            });
            const data = await res.json();
            if (res.ok && data.integrations) {
                setStatuses(data.integrations);

                const initialForms: Record<string, Record<string, string>> = {};
                for (const def of INTEGRATIONS) {
                    const status = data.integrations[def.id];
                    const form: Record<string, string> = {};
                    for (const field of def.fields) {
                        const existing = status?.fields?.[field.key];
                        form[field.key] = typeof existing === "string" ? existing : "";
                    }
                    initialForms[def.id] = form;
                }
                setFormValues(initialForms);
            }
        } catch {
            setMessage({ type: "error", text: "Failed to load integration statuses" });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadStatuses();
    }, [loadStatuses]);

    function handleFieldChange(integrationId: string, fieldKey: string, value: string) {
        setFormValues((prev) => ({
            ...prev,
            [integrationId]: { ...prev[integrationId], [fieldKey]: value }
        }));
    }

    async function handleSave(integrationId: string) {
        setSaving(integrationId);
        setMessage(null);
        try {
            const body = formValues[integrationId] ?? {};
            const res = await fetch(`/admin/api/settings/integrations/${integrationId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save");
            setMessage({ type: "success", text: `${integrationId} configuration saved.` });
            await loadStatuses();
        } catch (err) {
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to save"
            });
        } finally {
            setSaving(null);
        }
    }

    async function handleTest(integrationId: string) {
        setTesting(integrationId);
        setMessage(null);
        try {
            const res = await fetch(`/admin/api/settings/integrations/${integrationId}/test`, {
                method: "POST",
                credentials: "include"
            });
            const data = await res.json();
            if (data.ok) {
                setMessage({ type: "success", text: `${integrationId}: ${data.message}` });
            } else {
                setMessage({
                    type: "error",
                    text: `${integrationId}: ${data.message || data.error}`
                });
            }
        } catch {
            setMessage({ type: "error", text: `Failed to test ${integrationId}` });
        } finally {
            setTesting(null);
        }
    }

    async function handleDisconnect(integrationId: string) {
        setDisconnecting(integrationId);
        setMessage(null);
        try {
            const res = await fetch(`/admin/api/settings/integrations/${integrationId}`, {
                method: "DELETE",
                credentials: "include"
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to disconnect");
            setMessage({ type: "success", text: `${integrationId} disconnected.` });
            setExpandedId(null);
            await loadStatuses();
        } catch (err) {
            setMessage({
                type: "error",
                text: err instanceof Error ? err.message : "Failed to disconnect"
            });
        } finally {
            setDisconnecting(null);
        }
    }

    function toggleExpand(id: string) {
        setExpandedId((prev) => (prev === id ? null : id));
        setMessage(null);
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Integrations</h1>
                    <p className="text-muted-foreground mt-1 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Integrations</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Manage platform-level integrations for notifications, billing, and background
                    processing.
                </p>
            </div>

            {message && (
                <div
                    className={`rounded-md px-3 py-2 text-sm ${
                        message.type === "success"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-red-500/10 text-red-600"
                    }`}
                >
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {INTEGRATIONS.map((def) => {
                    const status = statuses[def.id];
                    const isExpanded = expandedId === def.id;
                    const isBusy =
                        saving === def.id || testing === def.id || disconnecting === def.id;
                    const IconComponent = ICONS[def.id];

                    return (
                        <div
                            key={def.id}
                            className="bg-card border-border rounded-lg border transition-shadow hover:shadow-sm"
                        >
                            <button
                                onClick={() => toggleExpand(def.id)}
                                className="flex w-full items-center justify-between p-4 text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`${def.color}`}>
                                        {IconComponent && <IconComponent />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold">{def.name}</p>
                                        <p className="text-muted-foreground text-xs">
                                            {def.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                            status?.configured
                                                ? "bg-green-500/10 text-green-600"
                                                : "bg-gray-500/10 text-gray-500"
                                        }`}
                                    >
                                        <span
                                            className={`h-1.5 w-1.5 rounded-full ${
                                                status?.configured ? "bg-green-500" : "bg-gray-400"
                                            }`}
                                        />
                                        {status?.configured ? "Connected" : "Not configured"}
                                    </span>
                                    <svg
                                        className={`text-muted-foreground h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="m19 9-7 7-7-7"
                                        />
                                    </svg>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="border-border border-t px-4 pt-3 pb-4">
                                    {status?.configured && status.configuredAt && (
                                        <p className="text-muted-foreground mb-3 text-xs">
                                            Configured{" "}
                                            {new Date(status.configuredAt).toLocaleDateString(
                                                "en-US",
                                                {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                    hour: "numeric",
                                                    minute: "2-digit"
                                                }
                                            )}
                                        </p>
                                    )}

                                    <div className="space-y-3">
                                        {def.fields.map((field) => (
                                            <div key={field.key}>
                                                <label className="text-muted-foreground mb-1 flex items-center gap-1 text-xs font-medium">
                                                    {field.label}
                                                    {field.required && (
                                                        <span className="text-red-400">*</span>
                                                    )}
                                                </label>
                                                <input
                                                    type={field.type}
                                                    value={formValues[def.id]?.[field.key] ?? ""}
                                                    onChange={(e) =>
                                                        handleFieldChange(
                                                            def.id,
                                                            field.key,
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder={field.placeholder}
                                                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                                                    disabled={isBusy}
                                                />
                                                {field.help && (
                                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                                        {field.help}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4 flex items-center gap-2">
                                        <button
                                            onClick={() => handleSave(def.id)}
                                            disabled={isBusy}
                                            className="rounded-md bg-purple-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-600 disabled:opacity-50"
                                        >
                                            {saving === def.id ? "Saving..." : "Save"}
                                        </button>

                                        {status?.configured && (
                                            <>
                                                <button
                                                    onClick={() => handleTest(def.id)}
                                                    disabled={isBusy}
                                                    className="rounded-md bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
                                                >
                                                    {testing === def.id
                                                        ? "Testing..."
                                                        : "Test Connection"}
                                                </button>
                                                <button
                                                    onClick={() => handleDisconnect(def.id)}
                                                    disabled={isBusy}
                                                    className="rounded-md bg-gray-500/10 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-500/20 disabled:opacity-50"
                                                >
                                                    {disconnecting === def.id
                                                        ? "Removing..."
                                                        : "Disconnect"}
                                                </button>
                                            </>
                                        )}

                                        {def.docsUrl && (
                                            <a
                                                href={def.docsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground ml-auto text-xs underline hover:no-underline"
                                            >
                                                Docs
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
