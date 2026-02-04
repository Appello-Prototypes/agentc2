import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    queryBimElements,
    computeTakeoff,
    computeDiff,
    computeClashes,
    computeHandoverRegister
} from "../bim";

const bimFilterSchema = z
    .object({
        categories: z.array(z.string()).optional(),
        systems: z.array(z.string()).optional(),
        levels: z.array(z.string()).optional(),
        types: z.array(z.string()).optional(),
        search: z.string().optional()
    })
    .optional();

export const bimQueryTool = createTool({
    id: "bim-query",
    description: "Query BIM elements with filters (category, system, level, type).",
    inputSchema: z.object({
        versionId: z.string().describe("BIM model version id"),
        filters: bimFilterSchema,
        limit: z.number().optional().describe("Max elements to return"),
        offset: z.number().optional().describe("Pagination offset"),
        includeProperties: z.boolean().optional().describe("Include property entries"),
        includeGeometry: z.boolean().optional().describe("Include geometry summaries")
    }),
    outputSchema: z.object({
        total: z.number(),
        limit: z.number(),
        offset: z.number(),
        elements: z.array(z.any())
    }),
    execute: async ({ versionId, filters, limit, offset, includeProperties, includeGeometry }) => {
        return queryBimElements({
            versionId,
            filters,
            limit,
            offset,
            includeProperties,
            includeGeometry
        });
    }
});

export const bimTakeoffTool = createTool({
    id: "bim-takeoff",
    description: "Compute takeoff totals from a BIM model version.",
    inputSchema: z.object({
        versionId: z.string(),
        filters: bimFilterSchema,
        groupBy: z.enum(["category", "system", "type", "level"]).optional()
    }),
    outputSchema: z.object({
        summary: z.object({
            elementCount: z.number(),
            totalLength: z.number(),
            totalArea: z.number(),
            totalVolume: z.number()
        }),
        groups: z.array(z.any())
    }),
    execute: async ({ versionId, filters, groupBy }) => {
        return computeTakeoff({ versionId, filters, groupBy });
    }
});

export const bimDiffTool = createTool({
    id: "bim-diff",
    description: "Compare two BIM model versions by element GUID and properties.",
    inputSchema: z.object({
        fromVersionId: z.string(),
        toVersionId: z.string(),
        includeChanges: z.boolean().optional()
    }),
    outputSchema: z.object({
        summary: z.object({
            added: z.number(),
            removed: z.number(),
            changed: z.number(),
            unchanged: z.number()
        }),
        changes: z.any().optional()
    }),
    execute: async ({ fromVersionId, toVersionId, includeChanges }) => {
        return computeDiff({ fromVersionId, toVersionId, includeChanges });
    }
});

export const bimClashTool = createTool({
    id: "bim-clash",
    description: "Run a simple bounding-box clash analysis for a BIM version.",
    inputSchema: z.object({
        versionId: z.string(),
        filters: bimFilterSchema,
        maxPairs: z.number().optional()
    }),
    outputSchema: z.object({
        summary: z.object({
            checkedPairs: z.number(),
            clashes: z.number(),
            capped: z.boolean()
        }),
        clashes: z.array(z.any())
    }),
    execute: async ({ versionId, filters, maxPairs }) => {
        return computeClashes({ versionId, filters, maxPairs });
    }
});

export const bimHandoverTool = createTool({
    id: "bim-handover",
    description: "Generate an asset register for operations and handover.",
    inputSchema: z.object({
        versionId: z.string(),
        filters: bimFilterSchema,
        propertyKeys: z.array(z.string()).optional()
    }),
    outputSchema: z.object({
        assetCount: z.number(),
        assets: z.array(z.any())
    }),
    execute: async ({ versionId, filters, propertyKeys }) => {
        return computeHandoverRegister({ versionId, filters, propertyKeys });
    }
});
