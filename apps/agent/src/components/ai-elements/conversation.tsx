"use client";

import * as React from "react";
import { cn } from "@repo/ui";

interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Conversation({ children, className, ...props }: ConversationProps) {
    return (
        <div className={cn("flex h-full flex-col overflow-hidden", className)} {...props}>
            {children}
        </div>
    );
}

interface ConversationContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function ConversationContent({ children, className, ...props }: ConversationContentProps) {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [children]);

    return (
        <div
            ref={scrollRef}
            className={cn("flex-1 space-y-4 overflow-y-auto scroll-smooth p-4", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export function ConversationScrollButton() {
    // Simplified scroll button - can be enhanced later
    return null;
}
