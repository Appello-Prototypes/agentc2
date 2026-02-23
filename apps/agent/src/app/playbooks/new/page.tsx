"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@repo/ui";
import { ArrowLeftIcon } from "lucide-react";

const CATEGORIES = [
    "Customer Support",
    "Sales",
    "Marketing",
    "Operations",
    "Research",
    "Finance",
    "HR",
    "Engineering",
    "General"
];

const PRICING_MODELS = [
    { value: "FREE", label: "Free" },
    { value: "ONE_TIME", label: "One-time Purchase" },
    { value: "SUBSCRIPTION", label: "Monthly Subscription" },
    { value: "PER_USE", label: "Per Use" }
];

export default function NewPlaybookPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        slug: "",
        description: "",
        tagline: "",
        category: "General",
        tags: "",
        pricingModel: "FREE",
        priceUsd: ""
    });

    function handleNameChange(name: string) {
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-");
        setForm((prev) => ({ ...prev, name, slug }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await fetch(`${getApiBase()}/api/playbooks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name,
                    slug: form.slug,
                    description: form.description,
                    tagline: form.tagline || undefined,
                    category: form.category,
                    tags: form.tags ? form.tags.split(",").map((t) => t.trim().toLowerCase()) : [],
                    pricingModel: form.pricingModel,
                    priceUsd:
                        form.pricingModel !== "FREE" && form.priceUsd
                            ? parseFloat(form.priceUsd)
                            : undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create playbook");
            }

            const data = await res.json();
            router.push(`/playbooks/${data.playbook.slug}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create playbook");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-2xl px-6 py-8">
            <button
                onClick={() => router.back()}
                className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-2 text-sm"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Playbooks
            </button>

            <h1 className="mb-6 text-2xl font-bold">Create New Playbook</h1>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Playbook Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => handleNameChange(e.target.value)}
                                placeholder="Customer Support Agent"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="slug">Slug</Label>
                            <Input
                                id="slug"
                                value={form.slug}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, slug: e.target.value }))
                                }
                                placeholder="customer-support-agent"
                                required
                            />
                            <p className="text-muted-foreground mt-1 text-xs">
                                URL-safe identifier. Must be unique.
                            </p>
                        </div>

                        <div>
                            <Label htmlFor="tagline">Tagline</Label>
                            <Input
                                id="tagline"
                                value={form.tagline}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, tagline: e.target.value }))
                                }
                                placeholder="AI-powered customer support with smart routing"
                            />
                        </div>

                        <div>
                            <Label htmlFor="description">Description</Label>
                            <textarea
                                id="description"
                                value={form.description}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, description: e.target.value }))
                                }
                                placeholder="Describe what this playbook does, what agents it includes, and who it's for..."
                                className="border-input bg-background min-h-[100px] w-full rounded-md border px-3 py-2 text-sm"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="category">Category</Label>
                            <select
                                id="category"
                                value={form.category}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, category: e.target.value }))
                                }
                                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label htmlFor="tags">Tags (comma-separated)</Label>
                            <Input
                                id="tags"
                                value={form.tags}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, tags: e.target.value }))
                                }
                                placeholder="support, customer-service, faq"
                            />
                        </div>

                        <div>
                            <Label htmlFor="pricing">Pricing Model</Label>
                            <select
                                id="pricing"
                                value={form.pricingModel}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        pricingModel: e.target.value
                                    }))
                                }
                                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                            >
                                {PRICING_MODELS.map((pm) => (
                                    <option key={pm.value} value={pm.value}>
                                        {pm.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {form.pricingModel !== "FREE" && (
                            <div>
                                <Label htmlFor="price">Price (USD)</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.priceUsd}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            priceUsd: e.target.value
                                        }))
                                    }
                                    placeholder="9.99"
                                />
                            </div>
                        )}

                        {error && (
                            <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? "Creating..." : "Create Playbook"}
                        </Button>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
