"use client";

import { type ReactNode } from "react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@repo/ui";

interface InspectorPanelProps {
    title: string;
    subtitle?: string;
    onDelete?: () => void;
    formTab?: ReactNode;
    mappingsTab?: ReactNode;
    jsonTab?: ReactNode;
    chatTab?: ReactNode;
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    footer?: ReactNode;
    className?: string;
    children?: ReactNode;
}

export function InspectorPanel({
    title,
    subtitle,
    onDelete,
    formTab,
    mappingsTab,
    jsonTab,
    chatTab,
    activeTab = "form",
    onTabChange,
    footer,
    className,
    children
}: InspectorPanelProps) {
    return (
        <div className={cn("flex h-full flex-col", className)}>
            <div className="border-b p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{title}</div>
                        {subtitle && (
                            <div className="text-muted-foreground text-xs">{subtitle}</div>
                        )}
                    </div>
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDelete}
                            className="text-destructive h-7 w-7 p-0"
                            title="Delete"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <Tabs
                    defaultValue="form"
                    value={activeTab}
                    onValueChange={onTabChange}
                    className="flex h-full flex-col"
                >
                    <TabsList className="mx-3 mt-3 w-auto">
                        <TabsTrigger value="form">Form</TabsTrigger>
                        <TabsTrigger value="mappings">Mappings</TabsTrigger>
                        <TabsTrigger value="json">JSON</TabsTrigger>
                        <TabsTrigger value="chat">Chat</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-y-auto p-3">
                        <TabsContent value="form" className="mt-0 space-y-4">
                            {formTab || children || (
                                <div className="text-muted-foreground text-sm">
                                    Select an element to configure.
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="mappings" className="mt-0 space-y-3">
                            {mappingsTab || (
                                <div className="text-muted-foreground text-sm">
                                    No mappings available.
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="json" className="mt-0 space-y-3">
                            {jsonTab || (
                                <div className="text-muted-foreground text-sm">
                                    No JSON editor available.
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="chat" className="mt-0 space-y-4">
                            {chatTab || (
                                <div className="text-muted-foreground text-sm">
                                    Chat assistant not configured.
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {footer && <div className="border-t p-3">{footer}</div>}
        </div>
    );
}
