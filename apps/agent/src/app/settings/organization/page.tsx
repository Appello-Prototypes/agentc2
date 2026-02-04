"use client";

import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Button,
    Skeleton,
    Alert,
    AlertDescription,
    Textarea
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Organization {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    createdAt: string;
}

interface Membership {
    role: string;
}

export default function OrganizationSettingsPage() {
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [membership, setMembership] = useState<Membership | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [logoUrl, setLogoUrl] = useState("");

    useEffect(() => {
        fetchOrganization();
    }, []);

    async function fetchOrganization() {
        try {
            const res = await fetch(`${getApiBase()}/api/user/organization`);
            const data = await res.json();
            if (data.success) {
                setOrganization(data.organization);
                setMembership(data.membership);
                setName(data.organization.name || "");
                setSlug(data.organization.slug || "");
                setDescription(data.organization.description || "");
                setLogoUrl(data.organization.logoUrl || "");
            }
        } catch (err) {
            console.error("Failed to fetch organization:", err);
            setError("Failed to load organization");
        } finally {
            setLoading(false);
        }
    }

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${getApiBase()}/api/organizations/${organization?.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    description: description.trim() || null,
                    logoUrl: logoUrl.trim() || null
                })
            });

            const data = await res.json();
            if (data.success) {
                setOrganization(data.organization);
                setSuccess("Organization updated successfully");
            } else {
                setError(data.error || "Failed to update organization");
            }
        } catch (err) {
            console.error("Failed to update organization:", err);
            setError("Failed to update organization");
        } finally {
            setSaving(false);
        }
    };

    const canEdit = membership?.role === "owner" || membership?.role === "admin";
    const isOwner = membership?.role === "owner";

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="mb-2 h-8 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-20 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Organization</h1>
                    <p className="text-muted-foreground">Manage your organization settings</p>
                </div>
                <Alert variant="destructive">
                    <AlertDescription>
                        No organization found. Please contact support.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Organization</h1>
                <p className="text-muted-foreground">
                    Manage your organization settings and branding
                </p>
            </div>

            {/* Alerts */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {success && (
                <Alert>
                    <AlertDescription>{success}</AlertDescription>
                </Alert>
            )}

            {/* Organization Details */}
            <Card>
                <CardHeader>
                    <CardTitle>Organization Details</CardTitle>
                    <CardDescription>Basic information about your organization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Organization ID */}
                    <div>
                        <label className="text-sm font-medium">Organization ID</label>
                        <Input
                            value={organization.id}
                            disabled
                            className="bg-muted mt-1 font-mono text-sm"
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="text-sm font-medium">Organization Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your organization name"
                            disabled={!canEdit}
                            className="mt-1"
                        />
                    </div>

                    {/* Slug */}
                    <div>
                        <label className="text-sm font-medium">Slug</label>
                        <Input
                            value={slug}
                            onChange={(e) =>
                                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                            }
                            placeholder="organization-slug"
                            disabled={!canEdit}
                            className="mt-1"
                        />
                        <p className="text-muted-foreground mt-1 text-xs">
                            URL-friendly identifier for your organization
                        </p>
                    </div>

                    {/* Logo URL */}
                    <div>
                        <label className="text-sm font-medium">Logo URL</label>
                        <Input
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                            placeholder="https://example.com/logo.png"
                            disabled={!canEdit}
                            className="mt-1"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="A brief description of your organization"
                            disabled={!canEdit}
                            className="mt-1"
                            rows={3}
                        />
                    </div>

                    {/* Created Date */}
                    <div>
                        <label className="text-sm font-medium">Created</label>
                        <Input
                            value={formatDate(organization.createdAt)}
                            disabled
                            className="bg-muted mt-1"
                        />
                    </div>

                    {/* Save Button */}
                    {canEdit && (
                        <div className="flex justify-end">
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Danger Zone - Owner Only */}
            {isOwner && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        <CardDescription>Irreversible and destructive actions</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Transfer Ownership</p>
                                <p className="text-muted-foreground text-sm">
                                    Transfer organization ownership to another member
                                </p>
                            </div>
                            <Button variant="outline" disabled>
                                Transfer
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Delete Organization</p>
                                <p className="text-muted-foreground text-sm">
                                    Permanently delete this organization and all its data
                                </p>
                            </div>
                            <Button variant="destructive" disabled>
                                Delete Organization
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
