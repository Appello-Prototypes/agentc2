import { prisma, Prisma } from "@repo/database";
import type { BimElementFilters } from "../query";

export interface BimHandoverOptions {
    versionId: string;
    filters?: BimElementFilters;
    propertyKeys?: string[];
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

function pickProperties(
    properties: Prisma.JsonValue | null,
    keys?: string[]
): Record<string, unknown> | undefined {
    if (!properties || typeof properties !== "object") {
        return undefined;
    }
    const props = properties as Record<string, unknown>;
    if (!keys || keys.length === 0) {
        return props;
    }
    const picked: Record<string, unknown> = {};
    keys.forEach((key) => {
        if (key in props) {
            picked[key] = props[key];
        }
    });
    return Object.keys(picked).length > 0 ? picked : undefined;
}

export async function computeHandoverRegister(options: BimHandoverOptions) {
    const elements = await prisma.bimElement.findMany({
        where: buildWhere(options.versionId, options.filters),
        orderBy: { elementGuid: "asc" }
    });

    const assets = elements.map((element) => ({
        guid: element.elementGuid,
        name: element.name,
        category: element.category,
        system: element.system,
        level: element.level,
        type: element.type,
        properties: pickProperties(element.properties, options.propertyKeys)
    }));

    return {
        assetCount: assets.length,
        assets
    };
}
