import { randomUUID } from "crypto";
import type { BimAdapter, BimAdapterContext, BimElementNormalized, BimParsedModel } from "../types";

export interface SpeckleAdapterInput {
    object?: Record<string, unknown>;
    objectUrl?: string;
    token?: string;
    metadata?: Record<string, unknown>;
}

const EXCLUDED_KEYS = new Set([
    "elements",
    "children",
    "displayValue",
    "__typename",
    "@type",
    "id",
    "@id",
    "applicationId",
    "speckle_type",
    "speckle_id"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSpeckleObject(value: unknown): value is Record<string, unknown> {
    return (
        isRecord(value) &&
        (typeof value["@type"] === "string" ||
            typeof value["speckle_type"] === "string" ||
            typeof value["applicationId"] === "string")
    );
}

function coercePrimitive(value: unknown): string | number | boolean | null | undefined {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    return undefined;
}

function extractGeometry(node: Record<string, unknown>) {
    const bbox = (node["bbox"] || node["boundingBox"]) as Record<string, unknown> | undefined;
    if (!bbox) {
        return undefined;
    }

    const min = bbox["min"] as Record<string, unknown> | undefined;
    const max = bbox["max"] as Record<string, unknown> | undefined;
    if (!min || !max) {
        return undefined;
    }

    const toTriplet = (value?: Record<string, unknown>) => {
        if (!value) {
            return undefined;
        }
        const x = Number(value["x"]);
        const y = Number(value["y"]);
        const z = Number(value["z"]);
        if ([x, y, z].some((coord) => Number.isNaN(coord))) {
            return undefined;
        }
        return [x, y, z] as [number, number, number];
    };

    return {
        bboxMin: toTriplet(min),
        bboxMax: toTriplet(max)
    };
}

function extractProperties(node: Record<string, unknown>): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
        if (EXCLUDED_KEYS.has(key)) {
            continue;
        }

        const primitive = coercePrimitive(value);
        if (primitive !== undefined) {
            properties[key] = primitive;
        }
    }
    return properties;
}

function normalizeSpeckleElement(node: Record<string, unknown>): BimElementNormalized {
    const guid =
        (node["applicationId"] as string | undefined) ||
        (node["id"] as string | undefined) ||
        (node["@id"] as string | undefined) ||
        randomUUID();

    const properties = extractProperties(node);
    const geometry = extractGeometry(node);

    return {
        guid,
        name: (node["name"] as string | undefined) || guid,
        category: (node["category"] as string | undefined) || (node["@type"] as string | undefined),
        type: (node["@type"] as string | undefined) || (node["speckle_type"] as string | undefined),
        system: node["system"] as string | undefined,
        level: node["level"] as string | undefined,
        phase: node["phase"] as string | undefined,
        description: node["description"] as string | undefined,
        properties: Object.keys(properties).length > 0 ? properties : undefined,
        geometry
    };
}

function walkSpeckleTree(
    node: unknown,
    elements: BimElementNormalized[],
    visited: WeakSet<object>
) {
    if (!isRecord(node)) {
        return;
    }

    if (visited.has(node)) {
        return;
    }
    visited.add(node);

    if (isSpeckleObject(node)) {
        elements.push(normalizeSpeckleElement(node));
    }

    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            value.forEach((item) => walkSpeckleTree(item, elements, visited));
        } else if (isRecord(value)) {
            walkSpeckleTree(value, elements, visited);
        }
    }
}

async function fetchSpeckleObject(url: string, token?: string): Promise<Record<string, unknown>> {
    const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    if (!response.ok) {
        throw new Error(
            `Failed to fetch Speckle object: ${response.status} ${response.statusText}`
        );
    }

    return (await response.json()) as Record<string, unknown>;
}

export const speckleAdapter: BimAdapter<SpeckleAdapterInput> = {
    format: "speckle",
    parse: async (
        input: SpeckleAdapterInput,
        _context: BimAdapterContext
    ): Promise<BimParsedModel> => {
        let speckleObject = input.object;

        if (!speckleObject && input.objectUrl) {
            speckleObject = await fetchSpeckleObject(input.objectUrl, input.token);
        }

        if (!speckleObject) {
            throw new Error("Speckle adapter requires an object payload or objectUrl.");
        }

        const elements: BimElementNormalized[] = [];
        walkSpeckleTree(speckleObject, elements, new WeakSet());

        return {
            elements,
            metadata: input.metadata
        };
    }
};
