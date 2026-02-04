import { prisma, Prisma } from "@repo/database";

export interface BimDiffOptions {
    fromVersionId: string;
    toVersionId: string;
    includeChanges?: boolean;
}

function serialize(value: Prisma.JsonValue | null): string {
    if (!value) {
        return "";
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export async function computeDiff(options: BimDiffOptions) {
    const [fromElements, toElements] = await Promise.all([
        prisma.bimElement.findMany({
            where: { versionId: options.fromVersionId },
            select: {
                elementGuid: true,
                name: true,
                category: true,
                system: true,
                type: true,
                properties: true
            }
        }),
        prisma.bimElement.findMany({
            where: { versionId: options.toVersionId },
            select: {
                elementGuid: true,
                name: true,
                category: true,
                system: true,
                type: true,
                properties: true
            }
        })
    ]);

    const fromMap = new Map(fromElements.map((element) => [element.elementGuid, element]));
    const toMap = new Map(toElements.map((element) => [element.elementGuid, element]));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    for (const guid of fromMap.keys()) {
        if (!toMap.has(guid)) {
            removed.push(guid);
        }
    }

    for (const [guid, toElement] of toMap) {
        const fromElement = fromMap.get(guid);
        if (!fromElement) {
            added.push(guid);
            continue;
        }

        const changedFields =
            fromElement.name !== toElement.name ||
            fromElement.category !== toElement.category ||
            fromElement.system !== toElement.system ||
            fromElement.type !== toElement.type ||
            serialize(fromElement.properties) !== serialize(toElement.properties);

        if (changedFields) {
            changed.push(guid);
        }
    }

    return {
        summary: {
            added: added.length,
            removed: removed.length,
            changed: changed.length,
            unchanged: toElements.length - added.length - changed.length
        },
        changes:
            options.includeChanges === false
                ? undefined
                : {
                      added,
                      removed,
                      changed
                  }
    };
}
