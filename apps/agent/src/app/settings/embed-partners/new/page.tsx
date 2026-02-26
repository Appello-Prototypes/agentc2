"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Button,
    Input,
    Textarea,
    Alert,
    AlertDescription
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

export default function NewEmbedPartnerPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [allowedDomains, setAllowedDomains] = useState("");
    const [tokenMaxAgeSec, setTokenMaxAgeSec] = useState(3600);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [createdSecret, setCreatedSecret] = useState("");
    const [createdPartnerId, setCreatedPartnerId] = useState("");
    const [copied, setCopied] = useState(false);

    function handleNameChange(value: string) {
        setName(value);
        if (!slugTouched) {
            setSlug(
                value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "")
            );
        }
    }

    async function handleSave() {
        setError("");

        if (!name.trim() || !slug.trim()) {
            setError("Name and slug are required.");
            return;
        }

        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
            setError(
                "Slug must be lowercase alphanumeric with hyphens, cannot start or end with a hyphen."
            );
            return;
        }

        setSaving(true);
        try {
            const domains = allowedDomains
                .split("\n")
                .map((d) => d.trim())
                .filter(Boolean);

            const res = await fetch(`${getApiBase()}/api/embed-partners`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    allowedDomains: domains,
                    tokenMaxAgeSec
                })
            });
            const data = await res.json();

            if (!data.success) {
                setError(data.error || "Failed to create partner");
                return;
            }

            setCreatedSecret(data.signingSecret);
            setCreatedPartnerId(data.partner.id);
        } catch {
            setError("Failed to create partner");
        } finally {
            setSaving(false);
        }
    }

    async function handleCopySecret() {
        await navigator.clipboard.writeText(createdSecret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    if (createdSecret) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Partner Created</h1>
                    <p className="text-muted-foreground text-sm">
                        Save the signing secret below -- it will not be shown again.
                    </p>
                </div>

                <Alert>
                    <AlertDescription className="space-y-3">
                        <p className="font-medium">Signing Secret for &quot;{name}&quot;</p>
                        <div className="flex items-center gap-2">
                            <code className="bg-muted flex-1 rounded px-3 py-2 text-xs break-all">
                                {createdSecret}
                            </code>
                            <Button variant="outline" size="sm" onClick={handleCopySecret}>
                                {copied ? "Copied!" : "Copy"}
                            </Button>
                        </div>
                        <p className="text-muted-foreground text-xs">
                            The partner will use this secret to sign identity tokens. Store it
                            securely.
                        </p>
                    </AlertDescription>
                </Alert>

                <Button onClick={() => router.push(`/settings/embed-partners/${createdPartnerId}`)}>
                    Go to Partner Details
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Add Embed Partner</h1>
                <p className="text-muted-foreground text-sm">
                    Create a new external platform that can embed AgentC2.
                </p>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Partner Details</CardTitle>
                    <CardDescription>Basic configuration for the embed partner.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Name</label>
                        <Input
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="e.g. Appello"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Slug</label>
                        <Input
                            value={slug}
                            onChange={(e) => {
                                setSlugTouched(true);
                                setSlug(e.target.value);
                            }}
                            placeholder="e.g. appello"
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            URL-safe identifier. Lowercase letters, numbers, and hyphens only.
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Allowed Domains</label>
                        <Textarea
                            value={allowedDomains}
                            onChange={(e) => setAllowedDomains(e.target.value)}
                            placeholder={"app.example.com\nstaging.example.com"}
                            rows={3}
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            One domain per line. Restrict which domains can host the embed iframe.
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Token Max Age (seconds)</label>
                        <Input
                            type="number"
                            value={tokenMaxAgeSec}
                            onChange={(e) => setTokenMaxAgeSec(parseInt(e.target.value) || 3600)}
                            min={60}
                            max={86400}
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            Maximum age of identity tokens before they are rejected. Default: 3600
                            (1 hour).
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => router.push("/settings/embed-partners")}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Creating..." : "Create Partner"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
