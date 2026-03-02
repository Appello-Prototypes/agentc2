"use client";

import { Badge } from "@repo/ui";

const CATEGORIES = [
    "Incorrect Logic",
    "Security Concern",
    "Needs Tests",
    "Missing Context",
    "Style Issue",
    "Performance"
];

export function FeedbackCategoryChips({ onSelect }: { onSelect: (category: string) => void }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
                <Badge
                    key={cat}
                    variant="outline"
                    className="hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => onSelect(cat)}
                >
                    {cat}
                </Badge>
            ))}
        </div>
    );
}
