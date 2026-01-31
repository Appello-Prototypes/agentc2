"use client";

import * as React from "react";
import { cn } from "@repo/ui";

interface ConversationProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Conversation({ children, className, ...props }: ConversationProps) {
  return (
    <div
      className={cn("flex flex-col h-full overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface ConversationContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ConversationContent({
  children,
  className,
  ...props
}: ConversationContentProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [children]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex-1 overflow-y-auto space-y-4 p-4 scroll-smooth",
        className
      )}
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
