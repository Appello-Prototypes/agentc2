import { randomUUID } from "crypto";
import type { BimAdapter, BimAdapterContext, BimElementNormalized, BimParsedModel } from "../types";

export interface IfcAdapterInput {
    elements?: BimElementNormalized[];
    objects?: BimElementNormalized[];
    items?: BimElementNormalized[];
    metadata?: Record<string, unknown>;
}

function normalizeIfcElement(element: BimElementNormalized): BimElementNormalized {
    const guid = element.guid?.trim() || randomUUID();

    return {
        guid,
        name: element.name,
        category: element.category,
        type: element.type,
        family: element.family,
        system: element.system,
        level: element.level,
        phase: element.phase,
        description: element.description,
        properties: element.properties,
        geometry: element.geometry,
        propertyEntries: element.propertyEntries
    };
}

export const ifcAdapter: BimAdapter<IfcAdapterInput> = {
    format: "ifc",
    parse: async (input: IfcAdapterInput, _context: BimAdapterContext): Promise<BimParsedModel> => {
        const rawElements = input.elements || input.objects || input.items || [];

        if (!Array.isArray(rawElements) || rawElements.length === 0) {
            throw new Error(
                "IFC adapter expects a normalized element array from an IFC conversion step (IfcOpenShell/ifc.js)."
            );
        }

        return {
            elements: rawElements.map((element) => normalizeIfcElement(element)),
            metadata: input.metadata
        };
    }
};
