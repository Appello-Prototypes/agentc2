import { randomUUID } from "crypto";
import path from "path";
import { IfcAPI, LogLevel, type FlatMesh, type Vector } from "web-ifc";
import type {
    BimElementNormalized,
    BimGeometrySummary,
    BimParsedModel,
    BimPropertyEntry
} from "../types";
import { IFC_ELEMENT_TYPES, IFC_SPATIAL_TYPES, IFC_TYPE_CATEGORY } from "./ifc-types";

export interface IfcParseOptions {
    includeGeometry?: boolean;
    includeProperties?: boolean;
    includeSpatialStructure?: boolean;
}

interface QuantitySummary {
    length?: number;
    area?: number;
    volume?: number;
    units?: string;
}

const DEFAULT_OPTIONS: Required<IfcParseOptions> = {
    includeGeometry: true,
    includeProperties: true,
    includeSpatialStructure: true
};

function getIfcPrimitive(value: unknown): string | number | boolean | null | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "object" && "value" in value) {
        return getIfcPrimitive((value as { value?: unknown }).value);
    }
    return undefined;
}

function getIfcString(value: unknown): string | undefined {
    const primitive = getIfcPrimitive(value);
    if (primitive === undefined || primitive === null) {
        return undefined;
    }
    return String(primitive);
}

function extractValueFromProperty(property: Record<string, unknown>) {
    const valueKeys = [
        "NominalValue",
        "LengthValue",
        "AreaValue",
        "VolumeValue",
        "CountValue",
        "WeightValue",
        "TimeValue",
        "Value"
    ];

    for (const key of valueKeys) {
        if (key in property) {
            const value = getIfcPrimitive(property[key]);
            return { value, valueKey: key };
        }
    }

    const directValue = getIfcPrimitive(property);
    if (directValue !== undefined) {
        return { value: directValue, valueKey: "value" };
    }

    return { value: undefined, valueKey: undefined };
}

function extractUnitFromProperty(property: Record<string, unknown>) {
    if ("Unit" in property) {
        const unitValue = property.Unit as Record<string, unknown>;
        return (
            getIfcString(unitValue?.Name) ||
            getIfcString(unitValue?.UnitType) ||
            getIfcString(unitValue) ||
            undefined
        );
    }
    return undefined;
}

async function extractPropertyEntries(
    api: IfcAPI,
    modelId: number,
    expressId: number
): Promise<{ entries: BimPropertyEntry[]; quantities: QuantitySummary }> {
    const entries: BimPropertyEntry[] = [];
    const quantities: QuantitySummary = {};

    const propertySets = await api.properties.getPropertySets(modelId, expressId, false, true);
    if (!Array.isArray(propertySets)) {
        return { entries, quantities };
    }

    for (const set of propertySets) {
        const setRecord = set as Record<string, unknown>;
        const group =
            getIfcString(setRecord.Name) || getIfcString(setRecord.LongName) || "PropertySet";

        const properties = Array.isArray(setRecord.HasProperties) ? setRecord.HasProperties : [];
        const quantityItems = Array.isArray(setRecord.Quantities) ? setRecord.Quantities : [];
        const allItems = [...properties, ...quantityItems];

        for (const item of allItems) {
            const itemRecord = item as Record<string, unknown>;
            const name = getIfcString(itemRecord.Name);
            if (!name) {
                continue;
            }

            const { value, valueKey } = extractValueFromProperty(itemRecord);
            const unit = extractUnitFromProperty(itemRecord);

            if (typeof value === "number") {
                if (valueKey === "LengthValue") {
                    quantities.length = (quantities.length ?? 0) + value;
                    quantities.units = quantities.units || unit;
                } else if (valueKey === "AreaValue") {
                    quantities.area = (quantities.area ?? 0) + value;
                    quantities.units = quantities.units || unit;
                } else if (valueKey === "VolumeValue") {
                    quantities.volume = (quantities.volume ?? 0) + value;
                    quantities.units = quantities.units || unit;
                }
            }

            entries.push({
                group,
                name,
                value: value ?? null,
                unit,
                rawValue: value ?? null
            });
        }
    }

    return { entries, quantities };
}

function applyTransform(
    x: number,
    y: number,
    z: number,
    matrix: number[]
): [number, number, number] {
    const nx = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const ny = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const nz = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    return [nx, ny, nz];
}

function updateBounds(
    bounds: { min: [number, number, number]; max: [number, number, number] },
    point: [number, number, number]
) {
    bounds.min[0] = Math.min(bounds.min[0], point[0]);
    bounds.min[1] = Math.min(bounds.min[1], point[1]);
    bounds.min[2] = Math.min(bounds.min[2], point[2]);
    bounds.max[0] = Math.max(bounds.max[0], point[0]);
    bounds.max[1] = Math.max(bounds.max[1], point[1]);
    bounds.max[2] = Math.max(bounds.max[2], point[2]);
}

function resolveGeometrySummary(
    api: IfcAPI,
    modelId: number,
    expressId: number,
    quantities: QuantitySummary
): BimGeometrySummary | undefined {
    let mesh: FlatMesh | null = null;
    const bounds = {
        min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY] as [
            number,
            number,
            number
        ],
        max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY] as [
            number,
            number,
            number
        ]
    };

    try {
        mesh = api.GetFlatMesh(modelId, expressId);
        const geometries = mesh?.geometries as Vector<unknown> | undefined;
        if (geometries) {
            for (let i = 0; i < geometries.size(); i++) {
                const placedGeometry = geometries.get(i) as {
                    geometryExpressID: number;
                    flatTransformation: number[];
                };
                const geometry = api.GetGeometry(modelId, placedGeometry.geometryExpressID);
                const vertexData = api.GetVertexArray(
                    geometry.GetVertexData(),
                    geometry.GetVertexDataSize()
                );

                for (let v = 0; v < vertexData.length; v += 6) {
                    const x = vertexData[v];
                    const y = vertexData[v + 1];
                    const z = vertexData[v + 2];
                    const transformed = applyTransform(x, y, z, placedGeometry.flatTransformation);
                    updateBounds(bounds, transformed);
                }

                geometry.delete();
            }
        }
    } catch {
        // Ignore geometry failures and fall back to property quantities.
    } finally {
        mesh?.delete();
    }

    const hasBounds = bounds.min[0] !== Number.POSITIVE_INFINITY;
    const geometry: BimGeometrySummary = {
        length: quantities.length ?? undefined,
        area: quantities.area ?? undefined,
        volume: quantities.volume ?? undefined,
        units: quantities.units
    };

    if (hasBounds) {
        geometry.bboxMin = bounds.min;
        geometry.bboxMax = bounds.max;
        geometry.centroid = [
            (bounds.min[0] + bounds.max[0]) / 2,
            (bounds.min[1] + bounds.max[1]) / 2,
            (bounds.min[2] + bounds.max[2]) / 2
        ];
    }

    if (
        !hasBounds &&
        geometry.length === undefined &&
        geometry.area === undefined &&
        geometry.volume === undefined
    ) {
        return undefined;
    }

    return geometry;
}

type SpatialNode = {
    expressID: number;
    type: string;
    children?: SpatialNode[];
};

async function buildStoreyMap(api: IfcAPI, modelId: number) {
    const storeyMap = new Map<number, string>();
    const spatial = await api.properties.getSpatialStructure(modelId, false);
    if (!spatial) {
        return storeyMap;
    }

    const storeyTypeName = api.GetNameFromTypeCode(IFC_SPATIAL_TYPES.buildingStorey);
    const walk = (node: SpatialNode, currentStorey?: string) => {
        const nodeType = node.type?.toUpperCase?.() || node.type;
        let storeyName = currentStorey;

        if (nodeType === storeyTypeName) {
            const storeyProps = api.GetLine(modelId, node.expressID);
            storeyName = getIfcString(storeyProps?.Name) || `Storey-${node.expressID}`;
        }

        if (storeyName) {
            storeyMap.set(node.expressID, storeyName);
        }

        if (Array.isArray(node.children)) {
            for (const childNode of node.children) {
                if (storeyName) {
                    storeyMap.set(childNode.expressID, storeyName);
                }
                walk(childNode, storeyName);
            }
        }
    };

    walk(spatial as SpatialNode);
    return storeyMap;
}

export async function parseIfcBuffer(
    buffer: Buffer,
    options: IfcParseOptions = DEFAULT_OPTIONS
): Promise<BimParsedModel> {
    const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
    const api = new IfcAPI();
    const wasmPath = path.join(process.cwd(), "node_modules", "web-ifc");

    api.SetWasmPath(wasmPath, true);
    api.SetLogLevel(LogLevel.LOG_LEVEL_ERROR);

    await api.Init();

    let modelId = -1;
    try {
        modelId = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: true });
        if (modelId <= 0) {
            throw new Error("Failed to open IFC model.");
        }

        const schema = api.GetModelSchema(modelId);
        const storeyMap = resolvedOptions.includeSpatialStructure
            ? await buildStoreyMap(api, modelId)
            : new Map<number, string>();
        const seen = new Set<number>();
        const elements: BimElementNormalized[] = [];

        for (const typeCode of IFC_ELEMENT_TYPES) {
            const ids = api.GetLineIDsWithType(modelId, typeCode, true);
            for (let i = 0; i < ids.size(); i++) {
                const expressId = ids.get(i) as number;
                if (seen.has(expressId)) {
                    continue;
                }
                seen.add(expressId);

                const line = api.GetLine(modelId, expressId);
                const ifcTypeCode = api.GetLineType(modelId, expressId);
                const ifcTypeName = api.GetNameFromTypeCode(ifcTypeCode);
                const guid =
                    getIfcString(line?.GlobalId) ||
                    getIfcString(api.GetGuidFromExpressId(modelId, expressId)) ||
                    randomUUID();

                const { entries, quantities } = resolvedOptions.includeProperties
                    ? await extractPropertyEntries(api, modelId, expressId)
                    : { entries: [], quantities: {} };

                const geometry = resolvedOptions.includeGeometry
                    ? resolveGeometrySummary(api, modelId, expressId, quantities)
                    : undefined;

                const element: BimElementNormalized = {
                    guid,
                    name: getIfcString(line?.Name),
                    category: IFC_TYPE_CATEGORY[ifcTypeCode] || undefined,
                    type:
                        getIfcString(line?.PredefinedType) ||
                        getIfcString(line?.ObjectType) ||
                        ifcTypeName,
                    family: getIfcString(line?.ObjectType) || undefined,
                    system: undefined,
                    level: storeyMap.get(expressId),
                    description: getIfcString(line?.Description),
                    properties: {
                        ifcExpressId: expressId,
                        ifcType: ifcTypeName,
                        ifcPredefinedType: getIfcString(line?.PredefinedType) || undefined,
                        ifcTag: getIfcString(line?.Tag)
                    },
                    geometry,
                    propertyEntries: entries.length > 0 ? entries : undefined
                };

                elements.push(element);
            }
        }

        return {
            elements,
            metadata: {
                schema,
                parsedAt: new Date().toISOString(),
                elementCount: elements.length,
                storeysDetected: storeyMap.size,
                sourceFormat: "ifc"
            }
        };
    } finally {
        if (modelId > 0) {
            api.CloseModel(modelId);
        }
        api.Dispose();
    }
}
