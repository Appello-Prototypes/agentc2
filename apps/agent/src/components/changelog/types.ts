export interface FieldChange {
    field: string;
    action: "added" | "removed" | "modified";
    before?: unknown;
    after?: unknown;
    items?: string[];
}

export interface ChangeLogEntry {
    id: string;
    entityType: string;
    entityId: string;
    entitySlug: string | null;
    version: number;
    action: "create" | "update" | "rollback" | "delete";
    changes: FieldChange[];
    summary: string | null;
    reason: string | null;
    createdBy: string | null;
    createdAt: string;
}
