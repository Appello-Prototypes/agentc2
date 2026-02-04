import { randomUUID } from "crypto";
import type { BimAdapter, BimAdapterContext, BimElementNormalized, BimParsedModel } from "../types";

export interface CsvAdapterInput {
    csv: string;
    metadata?: Record<string, unknown>;
}

const KNOWN_COLUMNS = new Set([
    "guid",
    "elementguid",
    "id",
    "name",
    "category",
    "type",
    "family",
    "system",
    "level",
    "phase",
    "description",
    "length",
    "area",
    "volume",
    "units"
]);

function parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            values.push(current);
            current = "";
            continue;
        }

        current += char;
    }

    values.push(current);
    return values.map((value) => value.trim());
}

function coerceValue(value: string): string | number | boolean | null {
    if (value === "") {
        return null;
    }

    const lower = value.toLowerCase();
    if (lower === "true") {
        return true;
    }
    if (lower === "false") {
        return false;
    }

    const asNumber = Number(value);
    if (!Number.isNaN(asNumber) && value.trim() !== "") {
        return asNumber;
    }

    return value;
}

function resolveGuid(record: Record<string, string>): string {
    return record.guid || record.elementguid || record.id || randomUUID();
}

function buildElement(record: Record<string, string>): BimElementNormalized {
    const geometry = {
        length: record.length ? Number(record.length) : undefined,
        area: record.area ? Number(record.area) : undefined,
        volume: record.volume ? Number(record.volume) : undefined,
        units: record.units || undefined
    };

    const properties: Record<string, unknown> = {};
    const propertyEntries = Object.entries(record)
        .filter(([key]) => !KNOWN_COLUMNS.has(key))
        .map(([key, value]) => {
            const coerced = coerceValue(value);
            properties[key] = coerced;
            return {
                name: key,
                value: coerced,
                rawValue: value
            };
        });

    return {
        guid: resolveGuid(record),
        name: record.name || undefined,
        category: record.category || undefined,
        type: record.type || undefined,
        family: record.family || undefined,
        system: record.system || undefined,
        level: record.level || undefined,
        phase: record.phase || undefined,
        description: record.description || undefined,
        properties: Object.keys(properties).length > 0 ? properties : undefined,
        geometry: geometry.length || geometry.area || geometry.volume ? geometry : undefined,
        propertyEntries: propertyEntries.length > 0 ? propertyEntries : undefined
    };
}

export const csvAdapter: BimAdapter<CsvAdapterInput> = {
    format: "csv",
    parse: async (input: CsvAdapterInput, _context: BimAdapterContext): Promise<BimParsedModel> => {
        const lines = input.csv.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length < 2) {
            throw new Error("CSV adapter requires a header row and at least one data row.");
        }

        const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
        const elements = lines.slice(1).map((line) => {
            const values = parseCsvLine(line);
            const record: Record<string, string> = {};
            headers.forEach((header, index) => {
                record[header] = values[index] ?? "";
            });
            return buildElement(record);
        });

        return {
            elements,
            metadata: input.metadata
        };
    }
};
