"use client"

import { useState, useMemo, useCallback } from "react"
import { Badge, Button, Input, Skeleton } from "@repo/ui"

export interface ToolItem {
    id: string
    name: string
    description: string
    source: string
    category?: string
    tier?: string
}

interface ToolGroup {
    key: string
    displayName: string
    tools: ToolItem[]
    isMcp: boolean
    isFederation?: boolean
}

interface TierGroup {
    tier: string
    label: string
    groups: ToolGroup[]
    totalTools: number
    selectedTools: number
}

type FilterMode = "all" | "selected" | "platform" | "integrations" | "mcp" | "domain"

export interface ToolSelectorProps {
    tools: ToolItem[]
    selectedToolIds: string[] | Set<string>
    onSelectionChange: (toolIds: string[]) => void
    categoryOrder: string[]
    categoryTier?: Record<string, string>
    tierOrder?: string[]
    tierLabels?: Record<string, string>
    mcpServerStatus?: Record<string, { connected: boolean; toolCount: number }>
    mode?: "agent" | "skill"
    loading?: boolean
    mcpError?: string | null
    serverErrors?: Record<string, string>
}

const DEFAULT_TIER_ORDER = ["platform", "integrations", "mcp", "domain"]
const DEFAULT_TIER_LABELS: Record<string, string> = {
    platform: "Platform",
    integrations: "Integrations",
    mcp: "MCP",
    domain: "Domain",
}
const TIER_COLORS: Record<string, string> = {
    platform: "blue",
    integrations: "green",
    mcp: "cyan",
    domain: "purple",
}

function getTierBadgeClass(tier: string): string {
    const color = TIER_COLORS[tier]
    if (!color) return ""
    const map: Record<string, string> = {
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    }
    return map[color] || ""
}

export function ToolSelector({
    tools,
    selectedToolIds,
    onSelectionChange,
    categoryOrder,
    categoryTier = {},
    tierOrder = DEFAULT_TIER_ORDER,
    tierLabels = DEFAULT_TIER_LABELS,
    mcpServerStatus,
    mode = "agent",
    loading = false,
    mcpError,
    serverErrors = {},
}: ToolSelectorProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [activeFilter, setActiveFilter] = useState<FilterMode>("all")
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

    const selectedSet = useMemo(
        () => (selectedToolIds instanceof Set ? selectedToolIds : new Set(selectedToolIds)),
        [selectedToolIds]
    )

    const selectionLabel = mode === "skill" ? "attached" : "selected"

    const toolIdSet = useMemo(() => new Set(tools.map((t) => t.id)), [tools])

    const orphanedIds = useMemo(
        () => Array.from(selectedSet).filter((id) => !toolIdSet.has(id)),
        [selectedSet, toolIdSet]
    )

    const isToolSelected = useCallback(
        (toolId: string) => selectedSet.has(toolId),
        [selectedSet]
    )

    const toggleTool = useCallback(
        (toolId: string) => {
            const currentIds = Array.from(selectedSet)
            if (selectedSet.has(toolId)) {
                onSelectionChange(currentIds.filter((id) => id !== toolId))
            } else {
                onSelectionChange([...currentIds, toolId])
            }
        },
        [selectedSet, onSelectionChange]
    )

    const filteredAndGrouped = useMemo((): TierGroup[] => {
        let filtered = tools

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(
                (t) =>
                    t.id.toLowerCase().includes(q) ||
                    t.name.toLowerCase().includes(q) ||
                    (t.description && t.description.toLowerCase().includes(q))
            )
        }

        if (activeFilter === "selected") {
            filtered = filtered.filter((t) => selectedSet.has(t.id))
        } else if (activeFilter !== "all") {
            filtered = filtered.filter((t) => {
                const toolTier = t.tier || categoryTier[t.category || ""] || "domain"
                if (t.source && t.source.startsWith("mcp:")) return activeFilter === "mcp"
                return toolTier === activeFilter
            })
        }

        const builtInByCategory: Record<string, ToolItem[]> = {}
        const mcpByServer: Record<string, ToolItem[]> = {}
        const federationByOrg: Record<string, ToolItem[]> = {}

        filtered.forEach((tool) => {
            if (tool.id.startsWith("federation:")) {
                const orgSlug = tool.id.split(":")[1] || "unknown"
                if (!federationByOrg[orgSlug]) federationByOrg[orgSlug] = []
                federationByOrg[orgSlug]!.push(tool)
            } else if (tool.source && tool.source.startsWith("mcp:")) {
                const server = tool.source
                if (!mcpByServer[server]) mcpByServer[server] = []
                mcpByServer[server]!.push(tool)
            } else {
                const cat = tool.category || "Other"
                if (!builtInByCategory[cat]) builtInByCategory[cat] = []
                builtInByCategory[cat]!.push(tool)
            }
        })

        // Sort tools alphabetically within each bucket
        for (const tools of Object.values(builtInByCategory)) tools.sort((a, b) => a.id.localeCompare(b.id))
        for (const tools of Object.values(mcpByServer)) tools.sort((a, b) => a.id.localeCompare(b.id))
        for (const tools of Object.values(federationByOrg)) tools.sort((a, b) => a.id.localeCompare(b.id))

        // Group built-in tools by tier
        const tierGroupsMap: Record<string, ToolGroup[]> = {}
        for (const tier of tierOrder) tierGroupsMap[tier] = []

        const orderedCategories = [
            ...categoryOrder.filter((cat) => builtInByCategory[cat]),
            ...Object.keys(builtInByCategory)
                .filter((cat) => !categoryOrder.includes(cat))
                .sort(),
        ]

        for (const cat of orderedCategories) {
            const tier = categoryTier[cat] || "domain"
            if (!tierGroupsMap[tier]) tierGroupsMap[tier] = []
            tierGroupsMap[tier]!.push({
                key: `builtin:${cat}`,
                displayName: cat,
                tools: builtInByCategory[cat]!,
                isMcp: false,
            })
        }

        // MCP groups
        if (!tierGroupsMap["mcp"]) tierGroupsMap["mcp"] = []
        const sortedServers = Object.keys(mcpByServer).sort()
        for (const server of sortedServers) {
            tierGroupsMap["mcp"]!.push({
                key: server,
                displayName: server.replace("mcp:", ""),
                tools: mcpByServer[server]!,
                isMcp: true,
            })
        }

        // Federation goes into platform tier
        const sortedFedOrgs = Object.keys(federationByOrg).sort()
        for (const orgSlug of sortedFedOrgs) {
            if (!tierGroupsMap["platform"]) tierGroupsMap["platform"] = []
            tierGroupsMap["platform"]!.push({
                key: `federation:${orgSlug}`,
                displayName: orgSlug,
                tools: federationByOrg[orgSlug]!,
                isMcp: false,
                isFederation: true,
            })
        }

        // Inject orphaned tools (selected but not in available list) when relevant
        if (orphanedIds.length > 0 && (activeFilter === "all" || activeFilter === "selected")) {
            const orphanTools: ToolItem[] = orphanedIds
                .filter((id) => !searchQuery.trim() || id.toLowerCase().includes(searchQuery.toLowerCase()))
                .sort()
                .map((id) => ({
                    id,
                    name: id,
                    description: "This tool is selected but its source (MCP server) is not currently connected.",
                    source: "orphaned",
                    category: "Unavailable",
                    tier: "mcp",
                }))
            if (orphanTools.length > 0) {
                if (!tierGroupsMap["mcp"]) tierGroupsMap["mcp"] = []
                tierGroupsMap["mcp"]!.push({
                    key: "orphaned:unavailable",
                    displayName: "Unavailable (source disconnected)",
                    tools: orphanTools,
                    isMcp: true,
                })
            }
        }

        return tierOrder
            .filter((tier) => (tierGroupsMap[tier]?.length || 0) > 0)
            .map((tier) => {
                const groups = tierGroupsMap[tier]!
                const totalTools = groups.reduce((sum, g) => sum + g.tools.length, 0)
                const selectedTools = groups.reduce(
                    (sum, g) => sum + g.tools.filter((t) => selectedSet.has(t.id)).length,
                    0
                )
                return {
                    tier,
                    label: tierLabels[tier] || tier,
                    groups,
                    totalTools,
                    selectedTools,
                }
            })
    }, [tools, searchQuery, activeFilter, selectedSet, categoryOrder, categoryTier, tierOrder, tierLabels, orphanedIds])

    const totalSelected = selectedSet.size
    const tierBreakdown = useMemo(() => {
        const counts: Record<string, number> = {}
        for (const id of Array.from(selectedSet)) {
            const tool = tools.find((t) => t.id === id)
            if (!tool) {
                counts["mcp"] = (counts["mcp"] || 0) + 1
                continue
            }
            let tier = "domain"
            if (tool.source && tool.source.startsWith("mcp:")) {
                tier = "mcp"
            } else if (tool.tier) {
                tier = tool.tier
            } else if (tool.category && categoryTier[tool.category]) {
                tier = categoryTier[tool.category]!
            }
            counts[tier] = (counts[tier] || 0) + 1
        }
        return tierOrder
            .filter((t) => (counts[t] || 0) > 0)
            .map((t) => `${counts[t]} ${tierLabels[t]?.toLowerCase() || t}`)
            .join(" · ")
    }, [selectedSet, tools, categoryTier, tierOrder, tierLabels])

    const filterCounts = useMemo(() => {
        const counts: Record<string, number> = { all: tools.length, selected: selectedSet.size }
        for (const t of tools) {
            let tier = "domain"
            if (t.source && t.source.startsWith("mcp:")) tier = "mcp"
            else if (t.tier) tier = t.tier
            else if (t.category && categoryTier[t.category]) tier = categoryTier[t.category]!
            counts[tier] = (counts[tier] || 0) + 1
        }
        return counts
    }, [tools, selectedSet.size, categoryTier])

    const toggleCategoryCollapse = useCallback((key: string) => {
        setCollapsedCategories((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const selectAllForGroup = useCallback(
        (group: ToolGroup) => {
            const groupToolIds = group.tools.map((t) => t.id)
            const currentIds = Array.from(selectedSet)
            onSelectionChange([...new Set([...currentIds, ...groupToolIds])])
        },
        [selectedSet, onSelectionChange]
    )

    const deselectAllForGroup = useCallback(
        (group: ToolGroup) => {
            const groupToolIds = new Set(group.tools.map((t) => t.id))
            onSelectionChange(Array.from(selectedSet).filter((id) => !groupToolIds.has(id)))
        },
        [selectedSet, onSelectionChange]
    )

    const deselectAll = useCallback(() => {
        onSelectionChange([])
    }, [onSelectionChange])

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-32 w-full" />
            </div>
        )
    }

    const matchCount = searchQuery.trim()
        ? filteredAndGrouped.reduce((sum, tg) => sum + tg.totalTools, 0)
        : null

    return (
        <div className="border-border overflow-hidden rounded-lg border">
            {/* Toolbar: search + filter pills */}
            <div className="bg-muted/30 flex flex-wrap items-center gap-2 border-b p-3">
                <div className="relative min-w-[200px] flex-1">
                    <svg
                        className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tools by name or description..."
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap gap-1">
                    {(
                        [
                            { key: "all" as FilterMode, label: "All" },
                            {
                                key: "selected" as FilterMode,
                                label:
                                    mode === "skill"
                                        ? `Attached (${filterCounts.selected || 0})`
                                        : `Selected (${filterCounts.selected || 0})`,
                            },
                            ...tierOrder
                                .filter((t) => (filterCounts[t] || 0) > 0)
                                .map((t) => ({
                                    key: t as FilterMode,
                                    label: `${tierLabels[t] || t} (${filterCounts[t] || 0})`,
                                })),
                        ] as { key: FilterMode; label: string }[]
                    ).map((pill) => (
                        <button
                            key={pill.key}
                            type="button"
                            onClick={() => setActiveFilter(pill.key)}
                            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                                activeFilter === pill.key
                                    ? pill.key === "selected"
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                        : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                            }`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search result count */}
            {matchCount !== null && (
                <div className="text-muted-foreground border-b px-4 py-2 text-xs">
                    {matchCount} result{matchCount !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
                </div>
            )}

            {/* Tool list */}
            <div className="max-h-[520px] overflow-auto">
                {filteredAndGrouped.length === 0 && (
                    <div className="text-muted-foreground py-12 text-center text-sm">
                        {searchQuery.trim()
                            ? `No tools matching "${searchQuery}"`
                            : activeFilter === "selected"
                              ? `No tools ${selectionLabel}`
                              : "No tools available"}
                    </div>
                )}

                {filteredAndGrouped.map((tierGroup) => (
                    <div key={tierGroup.tier}>
                        {/* Tier header */}
                        <div className="flex items-center gap-2 border-b px-4 py-2">
                            <span
                                className={`rounded border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${getTierBadgeClass(tierGroup.tier)}`}
                            >
                                {tierGroup.label}
                            </span>
                            <span className="text-muted-foreground font-mono text-[10px]">
                                {tierGroup.selectedTools} of {tierGroup.totalTools} {selectionLabel}
                            </span>
                            <div className="bg-border flex-1" style={{ height: "1px" }} />
                        </div>

                        {/* Category groups within tier */}
                        {tierGroup.groups.map((group) => {
                            const selectedCount = group.tools.filter((t) =>
                                isToolSelected(t.id)
                            ).length
                            const allSelected =
                                group.tools.length > 0 &&
                                group.tools.every((t) => isToolSelected(t.id))
                            const isCollapsed = collapsedCategories.has(group.key)
                            const mcpServerId = group.isMcp
                                ? group.displayName
                                : null
                            const mcpStatus = mcpServerId
                                ? mcpServerStatus?.[mcpServerId]
                                : null

                            return (
                                <div key={group.key} className="border-b last:border-b-0">
                                    {/* Category header */}
                                    <div className="flex items-center justify-between px-4 py-2 hover:bg-muted/30">
                                        <button
                                            type="button"
                                            className="flex items-center gap-2 text-left"
                                            onClick={() => toggleCategoryCollapse(group.key)}
                                        >
                                            <svg
                                                className={`text-muted-foreground h-3 w-3 shrink-0 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M9 5l7 7-7 7"
                                                />
                                            </svg>
                                            <span className="text-sm font-medium">
                                                {group.displayName}
                                            </span>
                                            <span
                                                className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                                                    selectedCount > 0
                                                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                                        : "border-border bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {selectedCount}/{group.tools.length}
                                            </span>
                                            {mcpStatus && (
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[9px] ${
                                                        mcpStatus.connected
                                                            ? "border-emerald-500/20 text-emerald-400"
                                                            : "border-red-500/20 text-red-400"
                                                    }`}
                                                >
                                                    {mcpStatus.connected
                                                        ? "Connected"
                                                        : "Error"}
                                                </Badge>
                                            )}
                                            {group.isFederation && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[9px] border-purple-500/20 text-purple-400"
                                                >
                                                    Federation
                                                </Badge>
                                            )}
                                        </button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-muted-foreground h-auto px-2 py-1 text-[11px]"
                                            onClick={() =>
                                                allSelected
                                                    ? deselectAllForGroup(group)
                                                    : selectAllForGroup(group)
                                            }
                                        >
                                            {allSelected ? "Deselect All" : "Select All"}
                                        </Button>
                                    </div>

                                    {/* Tool items */}
                                    {!isCollapsed && (
                                        <div className="grid grid-cols-1 gap-1 px-4 pb-3 md:grid-cols-2">
                                            {group.tools.map((tool) => {
                                                const isChecked = isToolSelected(tool.id)
                                                const isOrphaned = tool.source === "orphaned"
                                                return (
                                                    <label
                                                        key={tool.id}
                                                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                                            isOrphaned
                                                                ? "border-amber-500/30 bg-amber-500/5"
                                                                : isChecked
                                                                  ? "border-primary bg-primary/5"
                                                                  : "border-transparent hover:bg-muted/50"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleTool(tool.id)}
                                                            className="mt-0.5"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-baseline gap-1.5">
                                                                <span className="text-xs font-medium">
                                                                    {tool.name}
                                                                </span>
                                                                {isOrphaned && (
                                                                    <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
                                                                        Disconnected
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {tool.description && (
                                                                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px]">
                                                                    {tool.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>

            {/* MCP errors */}
            {mcpError && (
                <div className="border-t border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
                    <p className="font-medium">
                        {Object.keys(serverErrors).length > 0
                            ? `${Object.keys(serverErrors).length} MCP server(s) failed to load`
                            : "MCP tools unavailable"}
                    </p>
                    {Object.keys(serverErrors).length > 0 && (
                        <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs opacity-80">
                            {Object.entries(serverErrors).map(([server, error]) => (
                                <li key={server}>
                                    <span className="font-medium">{server}</span>:{" "}
                                    {(error as string).length > 120
                                        ? (error as string).slice(0, 120) + "..."
                                        : error}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Summary bar */}
            <div className="bg-muted/30 flex items-center justify-between border-t px-4 py-3">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-emerald-400">
                        {totalSelected} tool{totalSelected !== 1 ? "s" : ""} {selectionLabel}
                    </span>
                    {tierBreakdown && (
                        <span className="text-muted-foreground text-[11px]">{tierBreakdown}</span>
                    )}
                </div>
                {totalSelected > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={deselectAll}
                        className="h-7 text-xs"
                    >
                        Deselect All
                    </Button>
                )}
            </div>
        </div>
    )
}
