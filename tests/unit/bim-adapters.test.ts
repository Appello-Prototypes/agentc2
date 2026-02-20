import { describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import path from "path";
import { ifcAdapter } from "../../packages/agentc2/src/bim/adapters/ifc-adapter";
import { csvAdapter } from "../../packages/agentc2/src/bim/adapters/csv-adapter";
import { speckleAdapter } from "../../packages/agentc2/src/bim/adapters/speckle-adapter";

describe("BIM adapters", () => {
    it("parses normalized IFC elements", async () => {
        const fixturePath = path.join(process.cwd(), "tests", "fixtures", "bim", "ifc-sample.json");
        const raw = await readFile(fixturePath, "utf-8");
        const input = JSON.parse(raw);

        const parsed = await ifcAdapter.parse(input, { sourceFormat: "ifc" });
        expect(parsed.elements).toHaveLength(2);
        expect(parsed.elements[0].guid).toBe("ifc-duct-001");
    });

    it("parses CSV elements into normalized records", async () => {
        const csv = [
            "guid,name,category,type,system,length,units",
            "csv-1,Supply Duct,Duct,SupplyAir,Supply,10.5,ft",
            "csv-2,Return Duct,Duct,ReturnAir,Return,9.2,ft"
        ].join("\n");

        const parsed = await csvAdapter.parse({ csv }, { sourceFormat: "csv" });
        expect(parsed.elements).toHaveLength(2);
        expect(parsed.elements[1].guid).toBe("csv-2");
        expect(parsed.elements[0].geometry?.length).toBe(10.5);
    });

    it("parses Speckle objects into elements", async () => {
        const speckleObject = {
            "@type": "Objects.Structural.Beam",
            id: "beam-1",
            name: "Beam 1",
            category: "Beam",
            children: [
                {
                    "@type": "Objects.Structural.Beam",
                    id: "beam-2",
                    name: "Beam 2",
                    category: "Beam"
                }
            ]
        };

        const parsed = await speckleAdapter.parse(
            { object: speckleObject },
            { sourceFormat: "speckle" }
        );
        expect(parsed.elements).toHaveLength(2);
    });
});
