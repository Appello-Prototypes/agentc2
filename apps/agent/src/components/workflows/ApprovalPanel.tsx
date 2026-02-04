"use client";

import { useState } from "react";
import { Button, Textarea, cn } from "@repo/ui";

interface ApprovalPanelProps {
    runId: string;
    step: string;
    workflowType: string;
    suspendedData: {
        reason?: string;
        preview?: string;
        contentType?: string;
        title?: string;
        content?: string;
        hashtags?: string[];
        wordCount?: number;
        reviewChecklist?: string[];
        actionType?: string;
    };
    onApprove: (
        runId: string,
        step: string,
        data: { approved: boolean; approvedBy?: string; editedContent?: string }
    ) => Promise<void>;
    onReject: (
        runId: string,
        step: string,
        data: { approved: boolean; approvedBy?: string; rejectionReason?: string }
    ) => Promise<void>;
    isLoading?: boolean;
    className?: string;
}

/**
 * ApprovalPanel - Rich approve/reject UI for human-in-the-loop workflows
 */
export function ApprovalPanel({
    runId,
    step,
    suspendedData,
    onApprove,
    onReject,
    isLoading = false,
    className
}: ApprovalPanelProps) {
    const [approverName, setApproverName] = useState("Demo User");
    const [rejectionReason, setRejectionReason] = useState("");
    const [editedContent, setEditedContent] = useState(suspendedData.content || "");
    const [showEditMode, setShowEditMode] = useState(false);
    const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

    const handleApprove = async () => {
        await onApprove(runId, step, {
            approved: true,
            approvedBy: approverName,
            editedContent: showEditMode ? editedContent : undefined
        });
    };

    const handleReject = async () => {
        await onReject(runId, step, {
            approved: false,
            approvedBy: approverName,
            rejectionReason: rejectionReason || "Content did not meet standards"
        });
    };

    const toggleCheckItem = (index: number) => {
        const newChecked = new Set(checkedItems);
        if (newChecked.has(index)) {
            newChecked.delete(index);
        } else {
            newChecked.add(index);
        }
        setCheckedItems(newChecked);
    };

    const allItemsChecked = suspendedData.reviewChecklist
        ? checkedItems.size === suspendedData.reviewChecklist.length
        : true;

    const contentTypeName =
        {
            blogPost: "Blog Post",
            tweet: "Tweet",
            linkedinPost: "LinkedIn Post",
            newsletter: "Newsletter"
        }[suspendedData.contentType || ""] || "Content";

    return (
        <div
            className={cn(
                "rounded-lg border-2 border-amber-500 bg-amber-50 p-6 dark:bg-amber-950/30",
                className
            )}
        >
            {/* Header */}
            <div className="mb-4 flex items-center gap-2">
                <svg
                    className="h-5 w-5 text-amber-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                    Workflow Suspended - Awaiting Approval
                </h3>
            </div>

            {/* Run info */}
            <div className="bg-background/50 mb-4 rounded p-3 text-sm">
                <div className="text-muted-foreground flex gap-4">
                    <span>
                        Run ID: <code className="text-foreground">{runId.slice(0, 8)}...</code>
                    </span>
                    <span>
                        Step: <code className="text-foreground">{step}</code>
                    </span>
                </div>
            </div>

            {/* Reason */}
            {suspendedData.reason && (
                <p className="mb-4 text-sm text-amber-800 dark:text-amber-200">
                    {suspendedData.reason}
                </p>
            )}

            {/* Content Preview */}
            {suspendedData.content && (
                <div className="mb-6">
                    <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-medium">{contentTypeName} Preview</h4>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowEditMode(!showEditMode)}
                        >
                            {showEditMode ? "Cancel Edit" : "Edit Before Approving"}
                        </Button>
                    </div>

                    <div className="bg-background rounded-lg border p-4">
                        {suspendedData.title && (
                            <h5 className="mb-2 text-lg font-semibold">{suspendedData.title}</h5>
                        )}

                        {showEditMode ? (
                            <Textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="min-h-[150px] font-mono text-sm"
                            />
                        ) : (
                            <p className="text-sm whitespace-pre-wrap">{suspendedData.content}</p>
                        )}

                        {suspendedData.hashtags && suspendedData.hashtags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {suspendedData.hashtags.map((tag, i) => (
                                    <span
                                        key={i}
                                        className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {suspendedData.wordCount && (
                            <p className="text-muted-foreground mt-3 text-xs">
                                {suspendedData.wordCount} words
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Review Checklist */}
            {suspendedData.reviewChecklist && suspendedData.reviewChecklist.length > 0 && (
                <div className="mb-6">
                    <h4 className="mb-2 font-medium">Review Checklist</h4>
                    <div className="space-y-2">
                        {suspendedData.reviewChecklist.map((item, index) => (
                            <label key={index} className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={checkedItems.has(index)}
                                    onChange={() => toggleCheckItem(index)}
                                    className="h-4 w-4 rounded border-gray-300"
                                />
                                <span
                                    className={cn(
                                        "text-sm",
                                        checkedItems.has(index) &&
                                            "text-muted-foreground line-through"
                                    )}
                                >
                                    {item}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Approver Name */}
            <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">Your Name</label>
                <input
                    type="text"
                    value={approverName}
                    onChange={(e) => setApproverName(e.target.value)}
                    className="bg-background w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="Enter your name..."
                />
            </div>

            {/* Rejection Reason (shown when rejecting) */}
            <div className="mb-6">
                <label className="mb-1 block text-sm font-medium">
                    Rejection Reason (optional)
                </label>
                <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this content is being rejected..."
                    className="h-20"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={handleApprove}
                    disabled={
                        isLoading ||
                        !approverName.trim() ||
                        (suspendedData.reviewChecklist && !allItemsChecked)
                    }
                    className="flex-1 bg-green-600 hover:bg-green-700"
                >
                    {isLoading ? "Processing..." : "Approve & Publish"}
                </Button>
                <Button
                    onClick={handleReject}
                    disabled={isLoading || !approverName.trim()}
                    variant="destructive"
                    className="flex-1"
                >
                    {isLoading ? "Processing..." : "Reject"}
                </Button>
            </div>

            {/* Checklist warning */}
            {suspendedData.reviewChecklist && !allItemsChecked && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Complete all checklist items before approving
                </p>
            )}
        </div>
    );
}

/**
 * CompactApprovalPanel - Simpler approve/reject for non-content workflows
 */
interface CompactApprovalPanelProps {
    runId: string;
    step: string;
    message: string;
    preview?: string;
    onApprove: () => Promise<void>;
    onReject: () => Promise<void>;
    isLoading?: boolean;
    className?: string;
}

export function CompactApprovalPanel({
    message,
    preview,
    onApprove,
    onReject,
    isLoading = false,
    className
}: CompactApprovalPanelProps) {
    return (
        <div
            className={cn(
                "rounded-lg border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/30",
                className
            )}
        >
            <div className="mb-3 flex items-center gap-2">
                <svg
                    className="h-4 w-4 text-amber-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
                <span className="font-medium text-amber-700 dark:text-amber-300">
                    Awaiting Approval
                </span>
            </div>

            <p className="mb-2 text-sm">{message}</p>

            {preview && (
                <pre className="bg-background mb-4 max-h-32 overflow-auto rounded p-2 text-xs">
                    {preview}
                </pre>
            )}

            <div className="flex gap-2">
                <Button
                    onClick={onApprove}
                    disabled={isLoading}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                >
                    {isLoading ? "..." : "Approve"}
                </Button>
                <Button onClick={onReject} disabled={isLoading} size="sm" variant="destructive">
                    {isLoading ? "..." : "Reject"}
                </Button>
            </div>
        </div>
    );
}
