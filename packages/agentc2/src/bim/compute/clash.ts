import { prisma, Prisma } from "@repo/database";
import type { BimElementFilters } from "../query";

export interface BimClashOptions {
    versionId: string;
    filters?: BimElementFilters;
    maxPairs?: number;
}

interface Bbox {
    min: [number, number, number];
    max: [number, number, number];
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

function toBbox(geometry: {
    bboxMin: Prisma.JsonValue | null;
    bboxMax: Prisma.JsonValue | null;
}): Bbox | null {
    const min = geometry.bboxMin as number[] | null;
    const max = geometry.bboxMax as number[] | null;
    if (!min || !max || min.length < 3 || max.length < 3) {
        return null;
    }
    return {
        min: [Number(min[0]), Number(min[1]), Number(min[2])],
        max: [Number(max[0]), Number(max[1]), Number(max[2])]
    };
}

function overlaps(a: Bbox, b: Bbox): boolean {
    return (
        a.min[0] <= b.max[0] &&
        a.max[0] >= b.min[0] &&
        a.min[1] <= b.max[1] &&
        a.max[1] >= b.min[1] &&
        a.min[2] <= b.max[2] &&
        a.max[2] >= b.min[2]
    );
}

export async function computeClashes(options: BimClashOptions) {
    const elements = await prisma.bimElement.findMany({
        where: buildWhere(options.versionId, options.filters),
        include: { geometrySummary: true }
    });

    const clashPairs: Array<{ a: string; b: string }> = [];
    const maxPairs = options.maxPairs ?? 100;
    let checked = 0;

    for (let i = 0; i < elements.length; i += 1) {
        const elementA = elements[i];
        if (!elementA.geometrySummary) {
            continue;
        }
        const bboxA = toBbox(elementA.geometrySummary);
        if (!bboxA) {
            continue;
        }

        for (let j = i + 1; j < elements.length; j += 1) {
            const elementB = elements[j];
            if (!elementB.geometrySummary) {
                continue;
            }
            const bboxB = toBbox(elementB.geometrySummary);
            if (!bboxB) {
                continue;
            }

            checked += 1;
            if (overlaps(bboxA, bboxB)) {
                clashPairs.push({ a: elementA.elementGuid, b: elementB.elementGuid });
            }
            if (clashPairs.length >= maxPairs) {
                break;
            }
        }
        if (clashPairs.length >= maxPairs) {
            break;
        }
    }

    return {
        summary: {
            checkedPairs: checked,
            clashes: clashPairs.length,
            capped: clashPairs.length >= maxPairs
        },
        clashes: clashPairs
    };
}
