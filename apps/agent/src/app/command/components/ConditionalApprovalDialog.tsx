"use client";

import { useState } from "react";
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@repo/ui";
import type { ReviewItem } from "../types";

interface ConditionalApprovalDialogProps {
    review: ReviewItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (
        review: ReviewItem,
        conditionMeta: { conditionType: "ci-checks"; repository?: string; ref?: string }
    ) => void;
    isActing: boolean;
}

export function ConditionalApprovalDialog({
    review,
    open,
    onOpenChange,
    onSubmit,
    isActing
}: ConditionalApprovalDialogProps) {
    const [conditionType] = useState<"ci-checks">("ci-checks");

    if (!review) return null;

    const repository = review.reviewContext?.repository || review.githubRepo || "";
    const ref = "";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Conditional Approval</DialogTitle>
                    <DialogDescription>
                        The workflow will stay suspended until the selected conditions are met. Once
                        met, it will be auto-approved.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Condition</label>
                        <div className="flex items-center gap-2 rounded-lg border p-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-5 w-5 items-center justify-center rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <span className="text-xs">CI</span>
                                </div>
                                <span className="text-sm font-medium">All CI Checks Pass</span>
                            </div>
                            <Badge variant="secondary" className="ml-auto text-xs">
                                {conditionType}
                            </Badge>
                        </div>
                    </div>

                    {repository && (
                        <div className="space-y-1">
                            <label className="text-muted-foreground text-xs font-medium">
                                Repository
                            </label>
                            <code className="bg-muted block rounded px-2 py-1 text-xs">
                                {repository}
                            </code>
                        </div>
                    )}

                    {ref && (
                        <div className="space-y-1">
                            <label className="text-muted-foreground text-xs font-medium">
                                Branch / Ref
                            </label>
                            <code className="bg-muted block rounded px-2 py-1 text-xs">{ref}</code>
                        </div>
                    )}

                    <div className="bg-muted/50 rounded-lg p-3 text-xs">
                        <p className="text-muted-foreground">
                            The system will check every 5 minutes. If all CI checks pass, the
                            approval will be auto-granted and the workflow will resume. If checks
                            fail, the approval will be rejected. Conditional approvals time out
                            after 24 hours.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isActing}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() =>
                            onSubmit(review, {
                                conditionType,
                                repository: repository || undefined,
                                ref: ref || undefined
                            })
                        }
                        disabled={isActing}
                    >
                        {isActing ? "Submitting..." : "Set Conditional"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
