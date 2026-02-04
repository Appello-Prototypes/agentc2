import { prisma, Prisma } from "@repo/database";
import type { BimElementFilters } from "../query";

export interface BimTakeoffOptions {
    versionId: string;
    filters?: BimElementFilters;
    groupBy?: "category" | "system" | "type" | "level";
}

function getNumericValue(value: unknown): number | null {
    if (typeof value === "number") {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
            return parsed;
        }
    }
    return null;
}

function extractMetric(element: {
    geometrySummary: { length: number | null; area: number | null; volume: number | null } | null;
    properties: Prisma.JsonValue | null;
}) {
    const geometry = element.geometrySummary;
    const properties =
        element.properties && typeof element.properties === "object"
            ? (element.properties as Record<string, unknown>)
            : {};

    const length =
        geometry?.length ??
        getNumericValue(properties.length) ??
        getNumericValue(properties.Length) ??
        null;
    const area =
        geometry?.area ??
        getNumericValue(properties.area) ??
        getNumericValue(properties.Area) ??
        null;
    const volume =
        geometry?.volume ??
        getNumericValue(properties.volume) ??
        getNumericValue(properties.Volume) ??
        null;

    return { length, area, volume };
}

function buildWhere(versionId: string, filters?: BimElementFilters): Prisma.BimElementWhereInput {
    const where: Prisma.BimElementWhereInput = { versionId };

    if (filters?.categories?.length) {
        where.category = { in: filters.categories };
    }
    if (filters?.systems?.length) {
        where.system = { in: filters.systems };
    }
    if (filters?.levels?.length) {
        where.level = { in: filters.levels };
    }
    if (filters?.types?.length) {
        where.type = { in: filters.types };
    }

    return where;
}

export async function computeTakeoff(options: BimTakeoffOptions) {
    const elements = await prisma.bimElement.findMany({
        where: buildWhere(options.versionId, options.filters),
        include: { geometrySummary: true }
    });

    const summary = {
        elementCount: elements.length,
        totalLength: 0,
        totalArea: 0,
        totalVolume: 0
    };

    const grouped: Record<string, typeof summary> = {};

    for (const element of elements) {
        const metrics = extractMetric(element);
        summary.totalLength += metrics.length ?? 0;
        summary.totalArea += metrics.area ?? 0;
        summary.totalVolume += metrics.volume ?? 0;

        if (options.groupBy) {
            const key = (element[options.groupBy] as string | null) || "Unspecified";
            if (!grouped[key]) {
                grouped[key] = { elementCount: 0, totalLength: 0, totalArea: 0, totalVolume: 0 };
            }
            grouped[key].elementCount += 1;
            grouped[key].totalLength += metrics.length ?? 0;
            grouped[key].totalArea += metrics.area ?? 0;
            grouped[key].totalVolume += metrics.volume ?? 0;
        }
    }

    return {
        summary,
        groups: Object.entries(grouped).map(([group, totals]) => ({
            group,
            ...totals
        }))
    };
}
