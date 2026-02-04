import { prisma, Prisma } from "@repo/database";

export interface BimElementFilters {
    categories?: string[];
    systems?: string[];
    levels?: string[];
    types?: string[];
    search?: string;
}

export interface BimQueryOptions {
    versionId: string;
    filters?: BimElementFilters;
    limit?: number;
    offset?: number;
    includeProperties?: boolean;
    includeGeometry?: boolean;
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
    if (filters?.search) {
        where.OR = [
            { name: { contains: filters.search, mode: "insensitive" } },
            { elementGuid: { contains: filters.search, mode: "insensitive" } },
            { category: { contains: filters.search, mode: "insensitive" } },
            { system: { contains: filters.search, mode: "insensitive" } }
        ];
    }

    return where;
}

export async function queryBimElements(options: BimQueryOptions) {
    const where = buildWhere(options.versionId, options.filters);
    const limit = options.limit ?? 200;
    const offset = options.offset ?? 0;

    const [elements, total] = await Promise.all([
        prisma.bimElement.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { elementGuid: "asc" },
            include: {
                geometrySummary: options.includeGeometry ?? true,
                propertyEntries: options.includeProperties ?? false
            }
        }),
        prisma.bimElement.count({ where })
    ]);

    return {
        elements,
        total,
        limit,
        offset
    };
}
