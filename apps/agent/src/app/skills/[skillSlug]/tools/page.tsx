"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getApiBase } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@repo/ui";
import { ToolSelector } from "@/components/tool-selector";
import type { ToolItem } from "@/components/tool-selector";

export default function SkillToolsPage() {
    const params = useParams();
    const skillSlug = params.skillSlug as string;

    const [skillId, setSkillId] = useState("");
    const [attachedToolIds, setAttachedToolIds] = useState<Set<string>>(new Set());
    const [availableTools, setAvailableTools] = useState<ToolItem[]>([]);
    const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
    const [categoryTier, setCategoryTier] = useState<Record<string, string>>({});
    const [tierOrder, setTierOrder] = useState<string[]>([]);
    const [tierLabels, setTierLabels] = useState<Record<string, string>>({});
    const [mcpServerStatus, setMcpServerStatus] = useState<
        Record<string, { connected: boolean; toolCount: number }>
    >({});
    const [loading, setLoading] = useState(true);
    const [toolsLoading, setToolsLoading] = useState(true);
    const [mcpError, setMcpError] = useState<string | null>(null);
    const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

    const pendingRef = useRef(false);

    const fetchSkill = useCallback(async () => {
        try {
            const res = await fetch(`${getApiBase()}/api/skills/${skillSlug}`);
            if (res.ok) {
                const data = await res.json();
                const s = data.skill || data;
                setSkillId(s.id);
                setAttachedToolIds(
                    new Set((s.tools || []).map((t: { toolId: string }) => t.toolId))
                );
            }
        } catch (err) {
            console.error("Failed to load skill:", err);
        } finally {
            setLoading(false);
        }
    }, [skillSlug]);

    const fetchTools = useCallback(async () => {
        setToolsLoading(true);
        try {
            const res = await fetch(`${getApiBase()}/api/agents/tools`, {
                credentials: "include"
            });
            if (res.ok) {
                const data = await res.json();
                setAvailableTools(data.tools || []);
                setCategoryOrder(data.toolCategoryOrder || []);
                setCategoryTier(data.toolCategoryTier || {});
                setTierOrder(data.toolTierOrder || []);
                setTierLabels(data.toolTierLabels || {});
                setMcpServerStatus(data.mcpServerStatus || {});
                setMcpError(data.mcpError ?? null);
                setServerErrors(data.serverErrors ?? {});
            }
        } catch (err) {
            console.error("Failed to load available tools:", err);
        } finally {
            setToolsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSkill();
        fetchTools();
    }, [fetchSkill, fetchTools]);

    const handleSelectionChange = useCallback(
        async (newIds: string[]) => {
            if (!skillId || pendingRef.current) return;
            pendingRef.current = true;

            const newSet = new Set(newIds);
            const added = newIds.filter((id) => !attachedToolIds.has(id));
            const removed = Array.from(attachedToolIds).filter((id) => !newSet.has(id));

            try {
                for (const toolId of added) {
                    await fetch(`${getApiBase()}/api/skills/${skillId}/tools`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ toolId })
                    });
                }
                for (const toolId of removed) {
                    await fetch(`${getApiBase()}/api/skills/${skillId}/tools`, {
                        method: "DELETE",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ toolId })
                    });
                }
                setAttachedToolIds(newSet);
            } catch (err) {
                console.error("Failed to update skill tools:", err);
                await fetchSkill();
            } finally {
                pendingRef.current = false;
            }
        },
        [skillId, attachedToolIds, fetchSkill]
    );

    if (loading || toolsLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tools</CardTitle>
                <CardDescription>Configure which tools this skill provides</CardDescription>
            </CardHeader>
            <CardContent>
                <ToolSelector
                    tools={availableTools}
                    selectedToolIds={attachedToolIds}
                    onSelectionChange={handleSelectionChange}
                    categoryOrder={categoryOrder}
                    categoryTier={categoryTier}
                    tierOrder={tierOrder}
                    tierLabels={tierLabels}
                    mcpServerStatus={mcpServerStatus}
                    mode="skill"
                    mcpError={mcpError}
                    serverErrors={serverErrors}
                />
            </CardContent>
        </Card>
    );
}
