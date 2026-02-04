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
    Avatar,
    AvatarImage,
    AvatarFallback,
    Skeleton,
    Alert,
    AlertDescription
} from "@repo/ui";
import { useSession } from "@repo/auth/client";
import { getApiBase } from "@/lib/utils";

interface UserProfile {
    id: string;
    name: string;
    email: string;
    image: string | null;
}

export default function ProfileSettingsPage() {
    const { data: session } = useSession();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState("");
    const [imageUrl, setImageUrl] = useState("");

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch(`${getApiBase()}/api/user/profile`);
                const data = await res.json();
                if (data.success && data.user) {
                    setProfile(data.user);
                    setName(data.user.name || "");
                    setImageUrl(data.user.image || "");
                }
            } catch (err) {
                console.error("Failed to fetch profile:", err);
                setError("Failed to load profile");
            } finally {
                setLoading(false);
            }
        }

        if (session?.user) {
            fetchProfile();
        }
    }, [session]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch(`${getApiBase()}/api/user/profile`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    image: imageUrl.trim() || null
                })
            });

            const data = await res.json();
            if (data.success) {
                setProfile(data.user);
                setSuccess("Profile updated successfully");
            } else {
                setError(data.error || "Failed to update profile");
            }
        } catch (err) {
            console.error("Failed to update profile:", err);
            setError("Failed to update profile");
        } finally {
            setSaving(false);
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <Skeleton className="mb-2 h-8 w-32" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Profile</h1>
                <p className="text-muted-foreground">Manage your personal account settings</p>
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

            {/* Profile Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                        Update your profile information visible to your team
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                        <Avatar className="size-20">
                            <AvatarImage src={imageUrl || undefined} alt={name} />
                            <AvatarFallback className="text-lg">
                                {getInitials(name || profile?.email || "U")}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <label className="text-sm font-medium">Profile Picture URL</label>
                            <Input
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://example.com/avatar.png"
                                className="mt-1"
                            />
                            <p className="text-muted-foreground mt-1 text-xs">
                                Enter a URL to your profile picture
                            </p>
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="text-sm font-medium">Display Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="mt-1"
                        />
                    </div>

                    {/* Email (read-only) */}
                    <div>
                        <label className="text-sm font-medium">Email Address</label>
                        <Input value={profile?.email || ""} disabled className="bg-muted mt-1" />
                        <p className="text-muted-foreground mt-1 text-xs">
                            Email cannot be changed at this time
                        </p>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>Irreversible and destructive actions</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Delete Account</p>
                            <p className="text-muted-foreground text-sm">
                                Permanently delete your account and all associated data
                            </p>
                        </div>
                        <Button variant="destructive" disabled>
                            Delete Account
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
