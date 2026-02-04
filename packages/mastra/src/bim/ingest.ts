import { randomUUID } from "crypto";
import { prisma, Prisma } from "@repo/database";
import type { BimAdapter, BimElementNormalized, BimParsedModel } from "./types";
import { ifcAdapter } from "./adapters/ifc-adapter";
import { speckleAdapter } from "./adapters/speckle-adapter";
import { csvAdapter } from "./adapters/csv-adapter";

export interface BimIngestRequest {
    modelId?: string;
    modelName: string;
    workspaceId?: string;
    ownerId?: string;
    sourceFormat: string;
    sourceUri?: string;
    sourceKey?: string;
    checksum?: string;
    metadata?: Record<string, unknown>;
    adapterInput: unknown;
}

export interface BimIngestResult {
    modelId: string;
    versionId: string;
    version: number;
    elementsIngested: number;
}

const jsonAdapter: BimAdapter<{
    elements: BimElementNormalized[];
    metadata?: Record<string, unknown>;
}> = {
    format: "json",
    parse: async (input) => {
        if (!Array.isArray(input.elements)) {
            throw new Error("JSON adapter expects { elements: [...] }");
        }
        return {
            elements: input.elements,
            metadata: input.metadata
        };
    }
};

const adapterMap: Record<string, BimAdapter<any>> = {
    ifc: ifcAdapter,
    speckle: speckleAdapter,
    csv: csvAdapter,
    json: jsonAdapter
};

function resolveAdapter(format: string): BimAdapter {
    const key = format.toLowerCase();
    const adapter = adapterMap[key];
    if (!adapter) {
        throw new Error(`Unsupported BIM format: ${format}`);
    }
    return adapter;
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
}

function toJsonNullable(value: unknown): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
    if (value === undefined || value === null) {
        return Prisma.DbNull;
    }
    return toJsonValue(value);
}

function buildPropertyRows(elementId: string, element: BimElementNormalized) {
    if (!element.propertyEntries || element.propertyEntries.length === 0) {
        return [];
    }

    return element.propertyEntries.map((entry) => {
        const value = entry.value;
        return {
            id: randomUUID(),
            elementId,
            group: entry.group ?? null,
            name: entry.name,
            valueString: typeof value === "string" ? value : null,
            valueNumber: typeof value === "number" ? value : null,
            valueBoolean: typeof value === "boolean" ? value : null,
            unit: entry.unit ?? null,
            rawValue: toJsonNullable(entry.rawValue ?? value)
        };
    });
}

function buildGeometryRow(elementId: string, element: BimElementNormalized) {
    if (!element.geometry) {
        return null;
    }

    return {
        id: randomUUID(),
        elementId,
        bboxMin: toJsonNullable(element.geometry.bboxMin),
        bboxMax: toJsonNullable(element.geometry.bboxMax),
        centroid: toJsonNullable(element.geometry.centroid),
        length: element.geometry.length ?? null,
        area: element.geometry.area ?? null,
        volume: element.geometry.volume ?? null,
        units: element.geometry.units ?? null,
        metadata: toJsonNullable(element.geometry.metadata)
    };
}

async function persistElements(versionId: string, elements: BimElementNormalized[]) {
    if (elements.length === 0) {
        return;
    }

    const elementRows = elements.map((element) => ({
        id: randomUUID(),
        versionId,
        elementGuid: element.guid,
        name: element.name ?? null,
        category: element.category ?? null,
        type: element.type ?? null,
        family: element.family ?? null,
        system: element.system ?? null,
        level: element.level ?? null,
        phase: element.phase ?? null,
        description: element.description ?? null,
        properties: toJsonNullable(element.properties)
    }));

    const elementIdMap = new Map<string, string>();
    elementRows.forEach((row) => elementIdMap.set(row.elementGuid, row.id));

    const geometryRows = elements
        .map((element) => buildGeometryRow(elementIdMap.get(element.guid) as string, element))
        .filter((row): row is NonNullable<typeof row> => row !== null);

    const propertyRows = elements.flatMap((element) =>
        buildPropertyRows(elementIdMap.get(element.guid) as string, element)
    );

    for (const batch of chunkArray(elementRows, 500)) {
        await prisma.bimElement.createMany({ data: batch });
    }

    if (geometryRows.length > 0) {
        for (const batch of chunkArray(geometryRows, 500)) {
            await prisma.bimGeometrySummary.createMany({ data: batch });
        }
    }

    if (propertyRows.length > 0) {
        for (const batch of chunkArray(propertyRows, 500)) {
            await prisma.bimElementProperty.createMany({ data: batch });
        }
    }
}

export interface BimVersionIngestRequest {
    versionId: string;
    elements: BimElementNormalized[];
    metadata?: Record<string, unknown>;
}

export async function ingestBimElementsForVersion(
    request: BimVersionIngestRequest
): Promise<BimIngestResult> {
    const version = await prisma.bimModelVersion.findUnique({
        where: { id: request.versionId }
    });

    if (!version) {
        throw new Error(`BIM model version not found: ${request.versionId}`);
    }

    await prisma.bimElement.deleteMany({ where: { versionId: request.versionId } });

    await persistElements(request.versionId, request.elements);

    const existingMetadata =
        version.metadata && typeof version.metadata === "object"
            ? (version.metadata as Record<string, unknown>)
            : {};
    const mergedMetadata = {
        ...existingMetadata,
        ...(request.metadata ?? {}),
        elementCount: request.elements.length
    };

    await prisma.bimModelVersion.update({
        where: { id: request.versionId },
        data: {
            status: "READY",
            metadata: toJsonValue(mergedMetadata)
        }
    });

    return {
        modelId: version.modelId,
        versionId: version.id,
        version: version.version,
        elementsIngested: request.elements.length
    };
}

export async function ingestBimModel(request: BimIngestRequest): Promise<BimIngestResult> {
    const adapter = resolveAdapter(request.sourceFormat);
    const parsed: BimParsedModel = await adapter.parse(request.adapterInput as never, {
        sourceFormat: request.sourceFormat,
        modelName: request.modelName
    });

    const model =
        request.modelId && (await prisma.bimModel.findUnique({ where: { id: request.modelId } }));

    const resolvedModel =
        model ||
        (await prisma.bimModel.create({
            data: {
                name: request.modelName,
                workspaceId: request.workspaceId,
                ownerId: request.ownerId,
                metadata: toJsonNullable(request.metadata)
            }
        }));

    const latestVersion = await prisma.bimModelVersion.findFirst({
        where: { modelId: resolvedModel.id },
        orderBy: { version: "desc" }
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    const version = await prisma.bimModelVersion.create({
        data: {
            modelId: resolvedModel.id,
            version: nextVersion,
            status: "PROCESSING",
            sourceFormat: request.sourceFormat,
            sourceUri: request.sourceUri ?? null,
            sourceKey: request.sourceKey ?? null,
            checksum: request.checksum ?? null,
            metadata: toJsonNullable(request.metadata)
        }
    });

    await persistElements(version.id, parsed.elements);

    await prisma.bimModelVersion.update({
        where: { id: version.id },
        data: {
            status: "READY",
            metadata: toJsonValue({
                ...(request.metadata ?? {}),
                elementCount: parsed.elements.length
            })
        }
    });

    return {
        modelId: resolvedModel.id,
        versionId: version.id,
        version: nextVersion,
        elementsIngested: parsed.elements.length
    };
}
