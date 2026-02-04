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
    Badge,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

interface Session {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    expiresAt: string;
    isCurrent: boolean;
}

export default function SecuritySettingsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Password form state
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    async function fetchSessions() {
        try {
            const res = await fetch(`${getApiBase()}/api/user/sessions`);
            const data = await res.json();
            if (data.success) {
                setSessions(data.sessions || []);
            }
        } catch (err) {
            console.error("Failed to fetch sessions:", err);
        } finally {
            setLoading(false);
        }
    }

    const handlePasswordChange = async () => {
        setError(null);
        setSuccess(null);

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match");
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        setChangingPassword(true);

        try {
            const res = await fetch(`${getApiBase()}/api/user/password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await res.json();
            if (data.success) {
                setSuccess("Password changed successfully");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                setError(data.error || "Failed to change password");
            }
        } catch (err) {
            console.error("Failed to change password:", err);
            setError("Failed to change password");
        } finally {
            setChangingPassword(false);
        }
    };

    const handleRevokeSession = async (sessionId: string) => {
        try {
            const res = await fetch(`${getApiBase()}/api/user/sessions/${sessionId}`, {
                method: "DELETE"
            });

            const data = await res.json();
            if (data.success) {
                setSessions((prev) => prev.filter((s) => s.id !== sessionId));
                setSuccess("Session revoked successfully");
            } else {
                setError(data.error || "Failed to revoke session");
            }
        } catch (err) {
            console.error("Failed to revoke session:", err);
            setError("Failed to revoke session");
        }
    };

    const handleRevokeAllSessions = async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/user/sessions`, {
                method: "DELETE"
            });

            const data = await res.json();
            if (data.success) {
                // Keep only current session
                setSessions((prev) => prev.filter((s) => s.isCurrent));
                setSuccess("All other sessions have been revoked");
            } else {
                setError(data.error || "Failed to revoke sessions");
            }
        } catch (err) {
            console.error("Failed to revoke sessions:", err);
            setError("Failed to revoke sessions");
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    const parseUserAgent = (ua: string | null) => {
        if (!ua) return "Unknown device";
        // Simple parsing - could be enhanced with a library
        if (ua.includes("Chrome")) return "Chrome";
        if (ua.includes("Firefox")) return "Firefox";
        if (ua.includes("Safari")) return "Safari";
        if (ua.includes("Edge")) return "Edge";
        return "Unknown browser";
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
                <h1 className="text-2xl font-bold">Security</h1>
                <p className="text-muted-foreground">Manage your password and active sessions</p>
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

            {/* Change Password */}
            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>
                        Update your password to keep your account secure
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Current Password</label>
                        <Input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">New Password</label>
                        <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Confirm New Password</label>
                        <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="mt-1"
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button
                            onClick={handlePasswordChange}
                            disabled={changingPassword || !currentPassword || !newPassword}
                        >
                            {changingPassword ? "Changing..." : "Change Password"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Active Sessions */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Active Sessions</CardTitle>
                            <CardDescription>
                                Manage devices where you&apos;re signed in
                            </CardDescription>
                        </div>
                        {sessions.length > 1 && (
                            <Button variant="outline" size="sm" onClick={handleRevokeAllSessions}>
                                Sign out all other devices
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {sessions.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No active sessions found</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Device</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sessions.map((session) => (
                                    <TableRow key={session.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {parseUserAgent(session.userAgent)}
                                                {session.isCurrent && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Current
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {session.ipAddress || "Unknown"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(session.createdAt)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {formatDate(session.expiresAt)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!session.isCurrent && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRevokeSession(session.id)}
                                                >
                                                    Revoke
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
