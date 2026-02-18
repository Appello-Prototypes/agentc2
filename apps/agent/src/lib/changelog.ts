import { prisma } from "@repo/database";

export interface FieldChange {
    field: string;
    action: "added" | "removed" | "modified";
    before?: unknown;
    after?: unknown;
    items?: string[];
}

export interface CreateChangeLogParams {
    entityType: "agent" | "workflow" | "network";
    entityId: string;
    entitySlug?: string;
    version: number;
    action: "create" | "update" | "rollback" | "delete";
    changes: FieldChange[];
    summary?: string;
    reason?: string;
    createdBy?: string;
}

export async function createChangeLog(params: CreateChangeLogParams) {
    const summary =
        params.summary ||
        (params.changes.length === 1
            ? describeChange(params.changes[0]!)
            : `${params.changes.length} configuration changes`);

    return prisma.changeLog.create({
        data: {
            entityType: params.entityType,
            entityId: params.entityId,
            entitySlug: params.entitySlug || null,
            version: params.version,
            action: params.action,
            changes: params.changes as unknown as object[],
            summary,
            reason: params.reason || null,
            createdBy: params.createdBy || null
        }
    });
}

function describeChange(change: FieldChange): string {
    if (change.action === "added" && change.items) {
        return `Added ${change.items.length} ${change.field}`;
    }
    if (change.action === "removed" && change.items) {
        return `Removed ${change.items.length} ${change.field}`;
    }
    if (change.action === "modified") {
        return `Updated ${change.field}`;
    }
    return `${change.action} ${change.field}`;
}

export function detectScalarChange(
    field: string,
    oldVal: unknown,
    newVal: unknown
): FieldChange | null {
    if (newVal === undefined) return null;
    if (oldVal === newVal) return null;
    return { field, action: "modified", before: oldVal, after: newVal };
}

export function detectJsonChange(
    field: string,
    oldVal: unknown,
    newVal: unknown
): FieldChange | null {
    if (newVal === undefined) return null;
    const sortedStringify = (val: unknown): string =>
        JSON.stringify(val, (_, v) =>
            v && typeof v === "object" && !Array.isArray(v)
                ? Object.keys(v)
                      .sort()
                      .reduce(
                          (acc, key) => {
                              acc[key] = v[key];
                              return acc;
                          },
                          {} as Record<string, unknown>
                      )
                : v
        );
    if (sortedStringify(oldVal) === sortedStringify(newVal)) return null;
    return { field, action: "modified", before: oldVal, after: newVal };
}

export function detectArrayChange(
    field: string,
    oldArr: string[],
    newArr: string[] | undefined
): FieldChange[] {
    if (newArr === undefined) return [];
    const oldSet = new Set(oldArr);
    const newSet = new Set(newArr);
    const added = newArr.filter((item) => !oldSet.has(item));
    const removed = oldArr.filter((item) => !newSet.has(item));
    const changes: FieldChange[] = [];
    if (added.length > 0) {
        changes.push({ field, action: "added", items: added });
    }
    if (removed.length > 0) {
        changes.push({ field, action: "removed", items: removed });
    }
    return changes;
}
