export interface BimGeometrySummary {
    bboxMin?: [number, number, number];
    bboxMax?: [number, number, number];
    centroid?: [number, number, number];
    length?: number;
    area?: number;
    volume?: number;
    units?: string;
    metadata?: Record<string, unknown>;
}

export interface BimPropertyEntry {
    group?: string;
    name: string;
    value?: string | number | boolean | null;
    unit?: string;
    rawValue?: unknown;
}

export interface BimElementNormalized {
    guid: string;
    name?: string;
    category?: string;
    type?: string;
    family?: string;
    system?: string;
    level?: string;
    phase?: string;
    description?: string;
    properties?: Record<string, unknown>;
    geometry?: BimGeometrySummary;
    propertyEntries?: BimPropertyEntry[];
}

export interface BimParsedModel {
    elements: BimElementNormalized[];
    metadata?: Record<string, unknown>;
}

export interface BimAdapterContext {
    modelName?: string;
    sourceFormat: string;
}

export interface BimAdapter<TInput = unknown> {
    format: string;
    parse: (input: TInput, context: BimAdapterContext) => Promise<BimParsedModel>;
}
