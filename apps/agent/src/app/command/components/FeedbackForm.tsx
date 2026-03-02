"use client";

import { Button, Textarea } from "@repo/ui";
import { FeedbackCategoryChips } from "./FeedbackCategoryChips";

interface FeedbackFormProps {
    feedbackText: string;
    onFeedbackTextChange: (text: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    isActing: boolean;
    feedbackInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function FeedbackForm({
    feedbackText,
    onFeedbackTextChange,
    onSubmit,
    onCancel,
    isActing,
    feedbackInputRef
}: FeedbackFormProps) {
    return (
        <div className="space-y-2 rounded-lg border p-3">
            <FeedbackCategoryChips
                onSelect={(cat) => {
                    const prefix = feedbackText.trim() ? `${feedbackText.trim()}\n` : "";
                    onFeedbackTextChange(`${prefix}[${cat}] `);
                    feedbackInputRef.current?.focus();
                }}
            />
            <Textarea
                ref={(el: HTMLTextAreaElement | null) => {
                    (feedbackInputRef as { current: HTMLTextAreaElement | null }).current = el;
                }}
                placeholder="Describe what changes or additional analysis you want…"
                value={feedbackText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    onFeedbackTextChange(e.target.value)
                }
                rows={3}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        onSubmit();
                    }
                    if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        onCancel();
                    }
                }}
            />
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Cmd+Enter to submit</span>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        onClick={onSubmit}
                        disabled={isActing || !feedbackText.trim()}
                    >
                        {isActing ? "Sending…" : "Send feedback"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
