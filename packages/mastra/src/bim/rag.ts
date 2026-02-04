import { prisma } from "@repo/database";
import { ingestDocument, queryRag, type ChunkOptions } from "../rag/pipeline";
import { queryBimElements, type BimElementFilters } from "./query";

export interface BimRagIngestOptions {
    versionId: string;
    sourceName?: string;
    chunkOptions?: ChunkOptions;
}

export async function ingestBimElementsToRag(options: BimRagIngestOptions) {
    const elements = await prisma.bimElement.findMany({
        where: { versionId: options.versionId },
        include: { geometrySummary: true }
    });

    const payload = elements.map((element) => ({
        guid: element.elementGuid,
        name: element.name,
        category: element.category,
        type: element.type,
        system: element.system,
        level: element.level,
        phase: element.phase,
        properties: element.properties,
        geometry: element.geometrySummary
            ? {
                  length: element.geometrySummary.length,
                  area: element.geometrySummary.area,
                  volume: element.geometrySummary.volume,
                  bboxMin: element.geometrySummary.bboxMin,
                  bboxMax: element.geometrySummary.bboxMax
              }
            : undefined
    }));

    return ingestDocument(JSON.stringify(payload), {
        type: "json",
        sourceId: `bim_${options.versionId}`,
        sourceName: options.sourceName || `BIM ${options.versionId}`,
        chunkOptions: options.chunkOptions
    });
}

export interface BimHybridQueryOptions {
    versionId: string;
    query: string;
    filters?: BimElementFilters;
    topK?: number;
    minScore?: number;
    limit?: number;
    offset?: number;
}

export async function queryBimHybrid(options: BimHybridQueryOptions) {
    const [structured, semantic] = await Promise.all([
        queryBimElements({
            versionId: options.versionId,
            filters: options.filters,
            limit: options.limit,
            offset: options.offset
        }),
        queryRag(options.query, {
            topK: options.topK,
            minScore: options.minScore,
            filter: { documentId: `bim_${options.versionId}` }
        })
    ]);

    return {
        structured,
        semantic
    };
}
