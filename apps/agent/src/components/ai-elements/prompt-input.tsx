"use client";

import * as React from "react";
import { cn } from "@repo/ui";

interface PromptInputProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  onSubmit?: () => void;
}

export function PromptInput({
  children,
  className,
  onSubmit,
  ...props
}: PromptInputProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex items-end gap-2 border-t bg-background p-4",
        className
      )}
      {...props}
    >
      {children}
    </form>
  );
}

interface PromptInputBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputBody({
  children,
  className,
  ...props
}: PromptInputBodyProps) {
  return (
    <div className={cn("flex-1 flex items-end gap-2", className)} {...props}>
      {children}
    </div>
  );
}

interface PromptInputTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function PromptInputTextarea({
  className,
  ...props
}: PromptInputTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [props.value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.closest("form");
      form?.requestSubmit();
    }
    props.onKeyDown?.(e);
  };

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      className={cn(
        "flex-1 resize-none rounded-lg border bg-background px-4 py-3 text-sm",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "min-h-[48px] max-h-[200px]",
        className
      )}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function PromptInputActions({
  children,
  className,
  ...props
}: PromptInputActionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      {children}
    </div>
  );
}
