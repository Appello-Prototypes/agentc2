"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@repo/ui";
import { getApiBase } from "@/lib/utils";

type EntityType = "agent" | "network" | "workflow";

interface ArchiveDeleteActionsProps {
    entityType: EntityType;
    entityId: string;
    entityName: string;
    entitySlug: string;
    isArchived: boolean;
    isSystem: boolean;
    isPlaybookSourced?: boolean;
    onComplete?: () => void;
    redirectTo?: string;
    variant?: "dropdown" | "buttons";
}

function getApiPath(entityType: EntityType, entityId: string, entitySlug: string) {
    if (entityType === "agent") {
        return `${getApiBase()}/api/agents/${entityId}`;
    }
    return `${getApiBase()}/api/${entityType}s/${entitySlug}`;
}

export function ArchiveDeleteActions({
    entityType,
    entityId,
    entityName,
    entitySlug,
    isArchived,
    isSystem,
    isPlaybookSourced,
    onComplete,
    redirectTo,
    variant = "dropdown"
}: ArchiveDeleteActionsProps) {
    const router = useRouter();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const apiPath = getApiPath(entityType, entityId, entitySlug);

    const handleArchiveToggle = async () => {
        setLoading(true);
        try {
            const res = await fetch(apiPath, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: isArchived ? "unarchive" : "archive"
                })
            });
            const data = await res.json();
            if (!data.success) {
                alert(`Error: ${data.error}`);
                return;
            }
            if (redirectTo) {
                router.push(redirectTo);
            }
            onComplete?.();
        } catch (error) {
            console.error(
                `Failed to ${isArchived ? "unarchive" : "archive"} ${entityType}:`,
                error
            );
            alert(`Failed to ${isArchived ? "unarchive" : "archive"} ${entityType}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await fetch(apiPath, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) {
                alert(`Error: ${data.error}`);
                return;
            }
            setDeleteDialogOpen(false);
            if (redirectTo) {
                router.push(redirectTo);
            }
            onComplete?.();
        } catch (error) {
            console.error(`Failed to delete ${entityType}:`, error);
            alert(`Failed to delete ${entityType}`);
        } finally {
            setLoading(false);
        }
    };

    if (isSystem) return null;

    if (variant === "buttons") {
        return (
            <>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleArchiveToggle}
                    disabled={loading}
                >
                    {isArchived ? "Unarchive" : "Archive"}
                </Button>
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={loading}
                >
                    Delete
                </Button>

                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete {entityType}?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete &quot;{entityName}&quot;. This action
                                cannot be undone.
                                {isPlaybookSourced && (
                                    <>
                                        {" "}
                                        This {entityType} was installed from a marketplace playbook.
                                        To cleanly remove everything, use Uninstall from the
                                        Installed Playbooks page.
                                    </>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </>
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    className="hover:bg-muted rounded-md p-1.5 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="text-muted-foreground"
                    >
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                    </svg>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveToggle();
                        }}
                        disabled={loading}
                    >
                        {isArchived ? "Unarchive" : "Archive"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialogOpen(true);
                        }}
                        disabled={loading}
                    >
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {entityType}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete &quot;{entityName}&quot;. This action
                            cannot be undone.
                            {isPlaybookSourced && (
                                <>
                                    {" "}
                                    This {entityType} was installed from a marketplace playbook. To
                                    cleanly remove everything, use Uninstall from the Installed
                                    Playbooks page.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
