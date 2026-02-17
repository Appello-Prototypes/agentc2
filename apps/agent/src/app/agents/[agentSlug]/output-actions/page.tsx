"use client"

import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch
} from "@repo/ui"
import { getApiBase } from "@/lib/utils"

type OutputAction = {
    id: string
    name: string
    type: "WEBHOOK" | "CHAIN_AGENT"
    configJson: Record<string, unknown>
    isActive: boolean
    createdAt: string
    updatedAt: string
}

const ACTION_TYPE_LABELS: Record<string, string> = {
    WEBHOOK: "Webhook",
    CHAIN_AGENT: "Chain Agent"
}

const ACTION_TYPE_DESCRIPTIONS: Record<string, string> = {
    WEBHOOK: "POST run output to an external URL",
    CHAIN_AGENT: "Forward output as input to another agent"
}

export default function OutputActionsPage() {
    const params = useParams()
    const agentSlug = params.agentSlug as string

    const [loading, setLoading] = useState(true)
    const [actions, setActions] = useState<OutputAction[]>([])
    const [error, setError] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingAction, setEditingAction] = useState<OutputAction | null>(null)
    const [testResult, setTestResult] = useState<{
        actionId: string
        success: boolean
        message: string
    } | null>(null)

    // Form state
    const [formName, setFormName] = useState("")
    const [formType, setFormType] = useState<string>("WEBHOOK")
    const [formActive, setFormActive] = useState(true)
    // Webhook config
    const [formUrl, setFormUrl] = useState("")
    const [formSecret, setFormSecret] = useState("")
    // Chain config
    const [formAgentSlug, setFormAgentSlug] = useState("")
    const [formInputTemplate, setFormInputTemplate] = useState("")

    const fetchActions = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const res = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/output-actions`
            )
            const data = await res.json()
            if (!data.success) {
                setError(data.error || "Failed to load output actions")
                return
            }
            setActions(data.outputActions || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load")
        } finally {
            setLoading(false)
        }
    }, [agentSlug])

    useEffect(() => {
        fetchActions()
    }, [fetchActions])

    const resetForm = () => {
        setFormName("")
        setFormType("WEBHOOK")
        setFormActive(true)
        setFormUrl("")
        setFormSecret("")
        setFormAgentSlug("")
        setFormInputTemplate("")
        setEditingAction(null)
    }

    const openCreate = () => {
        resetForm()
        setDialogOpen(true)
    }

    const openEdit = (action: OutputAction) => {
        setEditingAction(action)
        setFormName(action.name)
        setFormType(action.type)
        setFormActive(action.isActive)
        if (action.type === "WEBHOOK") {
            const config = action.configJson as { url?: string; secret?: string }
            setFormUrl(config.url || "")
            setFormSecret(config.secret || "")
        } else if (action.type === "CHAIN_AGENT") {
            const config = action.configJson as {
                agentSlug?: string
                inputTemplate?: string
            }
            setFormAgentSlug(config.agentSlug || "")
            setFormInputTemplate(config.inputTemplate || "")
        }
        setDialogOpen(true)
    }

    const buildConfigJson = () => {
        if (formType === "WEBHOOK") {
            const config: Record<string, unknown> = { url: formUrl }
            if (formSecret) config.secret = formSecret
            return config
        }
        if (formType === "CHAIN_AGENT") {
            const config: Record<string, unknown> = { agentSlug: formAgentSlug }
            if (formInputTemplate) config.inputTemplate = formInputTemplate
            return config
        }
        return {}
    }

    const handleSave = async () => {
        const configJson = buildConfigJson()
        const payload = {
            name: formName,
            type: formType,
            configJson,
            isActive: formActive
        }

        try {
            const url = editingAction
                ? `${getApiBase()}/api/agents/${agentSlug}/output-actions/${editingAction.id}`
                : `${getApiBase()}/api/agents/${agentSlug}/output-actions`
            const method = editingAction ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (!data.success) {
                setError(data.error || "Failed to save")
                return
            }
            setDialogOpen(false)
            resetForm()
            fetchActions()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save")
        }
    }

    const handleDelete = async (actionId: string) => {
        try {
            const res = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/output-actions/${actionId}`,
                { method: "DELETE" }
            )
            const data = await res.json()
            if (!data.success) {
                setError(data.error || "Failed to delete")
                return
            }
            fetchActions()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete")
        }
    }

    const handleToggleActive = async (action: OutputAction) => {
        try {
            const res = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/output-actions/${action.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isActive: !action.isActive })
                }
            )
            const data = await res.json()
            if (data.success) fetchActions()
        } catch {
            // Silently fail toggle
        }
    }

    const handleTest = async (actionId: string) => {
        setTestResult(null)
        try {
            const res = await fetch(
                `${getApiBase()}/api/agents/${agentSlug}/output-actions/${actionId}/test`,
                { method: "POST" }
            )
            const data = await res.json()
            setTestResult({
                actionId,
                success: data.success,
                message: data.success
                    ? "Delivered successfully"
                    : data.error || "Test failed"
            })
        } catch (err) {
            setTestResult({
                actionId,
                success: false,
                message: err instanceof Error ? err.message : "Test failed"
            })
        }
    }

    const getConfigSummary = (action: OutputAction) => {
        const config = action.configJson as Record<string, unknown>
        if (action.type === "WEBHOOK") {
            return (config.url as string) || "No URL configured"
        }
        if (action.type === "CHAIN_AGENT") {
            return `→ ${(config.agentSlug as string) || "unknown"}`
        }
        return ""
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">
                        Output Actions
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        Configure where this agent&apos;s outputs are routed
                        after execution.
                    </p>
                </div>
                <Button onClick={openCreate}>Create Output Action</Button>
            </div>

            {/* Info banner */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
                <CardContent className="pt-4 pb-4">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        Agents handle their own communication (Slack, email,
                        Jira, etc.) via MCP tools during execution. Output
                        actions handle plumbing: webhooks for external systems
                        and chaining to other agents. All outputs are
                        automatically vectorized into the shared knowledge base.
                    </p>
                </CardContent>
            </Card>

            {/* Error */}
            {error && (
                <Card className="border-destructive">
                    <CardContent className="pt-4 pb-4">
                        <p className="text-destructive text-sm">{error}</p>
                    </CardContent>
                </Card>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground text-sm">Loading...</p>
                </div>
            )}

            {/* Empty state */}
            {!loading && actions.length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <p className="text-muted-foreground mb-4 text-sm">
                            No output actions configured. Outputs are stored in
                            the database and auto-vectorized into the knowledge
                            base by default.
                        </p>
                        <Button variant="outline" onClick={openCreate}>
                            Create First Output Action
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Actions list */}
            {!loading &&
                actions.map((action) => (
                    <Card key={action.id} className="relative">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CardTitle className="text-base">
                                        {action.name}
                                    </CardTitle>
                                    <Badge
                                        variant={
                                            action.type === "WEBHOOK"
                                                ? "default"
                                                : "secondary"
                                        }
                                    >
                                        {ACTION_TYPE_LABELS[action.type] ||
                                            action.type}
                                    </Badge>
                                    <Badge
                                        variant={
                                            action.isActive
                                                ? "default"
                                                : "outline"
                                        }
                                    >
                                        {action.isActive
                                            ? "Active"
                                            : "Inactive"}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleTest(action.id)}
                                    >
                                        Test
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEdit(action)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                            handleToggleActive(action)
                                        }
                                    >
                                        {action.isActive
                                            ? "Disable"
                                            : "Enable"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        onClick={() =>
                                            handleDelete(action.id)
                                        }
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                            <CardDescription>
                                {ACTION_TYPE_DESCRIPTIONS[action.type]}
                                {" — "}
                                <span className="font-mono text-xs">
                                    {getConfigSummary(action)}
                                </span>
                            </CardDescription>
                        </CardHeader>
                        {testResult?.actionId === action.id && (
                            <CardContent className="pt-0">
                                <div
                                    className={`rounded-md p-3 text-sm ${
                                        testResult.success
                                            ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-200"
                                            : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                                    }`}
                                >
                                    {testResult.success ? "OK" : "FAIL"}:{" "}
                                    {testResult.message}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                ))}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingAction
                                ? "Edit Output Action"
                                : "Create Output Action"}
                        </DialogTitle>
                        <DialogDescription>
                            Configure where this agent&apos;s output is routed
                            after each run.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Forward to analytics"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label>Type</Label>
                            <Select
                                value={formType}
                                onValueChange={(val) => { if (val) setFormType(val) }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="WEBHOOK">
                                        Webhook
                                    </SelectItem>
                                    <SelectItem value="CHAIN_AGENT">
                                        Chain Agent
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Webhook config */}
                        {formType === "WEBHOOK" && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="url">Webhook URL</Label>
                                    <Input
                                        id="url"
                                        value={formUrl}
                                        onChange={(e) =>
                                            setFormUrl(e.target.value)
                                        }
                                        placeholder="https://example.com/webhook"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="secret">
                                        HMAC Secret (optional)
                                    </Label>
                                    <Input
                                        id="secret"
                                        value={formSecret}
                                        onChange={(e) =>
                                            setFormSecret(e.target.value)
                                        }
                                        placeholder="Optional signing secret"
                                        type="password"
                                    />
                                </div>
                            </>
                        )}

                        {/* Chain Agent config */}
                        {formType === "CHAIN_AGENT" && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="agentSlug">
                                        Target Agent Slug
                                    </Label>
                                    <Input
                                        id="agentSlug"
                                        value={formAgentSlug}
                                        onChange={(e) =>
                                            setFormAgentSlug(e.target.value)
                                        }
                                        placeholder="e.g., ceo"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="inputTemplate">
                                        Input Template (optional)
                                    </Label>
                                    <Input
                                        id="inputTemplate"
                                        value={formInputTemplate}
                                        onChange={(e) =>
                                            setFormInputTemplate(e.target.value)
                                        }
                                        placeholder="Review this report: {output}"
                                    />
                                    <p className="text-muted-foreground text-xs">
                                        Use {"{output}"} as a placeholder for
                                        the agent&apos;s output. Leave blank to
                                        pass the full output directly.
                                    </p>
                                </div>
                            </>
                        )}

                        <div className="flex items-center gap-3">
                            <Switch
                                checked={formActive}
                                onCheckedChange={setFormActive}
                            />
                            <Label>Active</Label>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={!formName}>
                            {editingAction ? "Save Changes" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
