import { describe, it, expect } from "vitest";
import { GET } from "../../../apps/agent/src/app/api/health/route";

describe("GET /api/health", () => {
    it("returns 200 status", async () => {
        const response = await GET();
        expect(response.status).toBe(200);
    });

    it("returns status field with value 'ok'", async () => {
        const response = await GET();
        const data = await response.json();
        expect(data.status).toBe("ok");
    });

    it("returns uptime field as number", async () => {
        const response = await GET();
        const data = await response.json();
        expect(typeof data.uptime).toBe("number");
        expect(data.uptime).toBeGreaterThanOrEqual(0);
    });

    it("returns timestamp field in ISO 8601 format", async () => {
        const response = await GET();
        const data = await response.json();
        expect(data.timestamp).toBeDefined();
        expect(typeof data.timestamp).toBe("string");

        // Validate ISO 8601 format
        const timestamp = new Date(data.timestamp);
        expect(timestamp.toISOString()).toBe(data.timestamp);

        // Timestamp should be recent (within last 5 seconds)
        const now = Date.now();
        const timestampMs = timestamp.getTime();
        expect(now - timestampMs).toBeLessThan(5000);
    });

    it("matches expected response schema", async () => {
        const response = await GET();
        const data = await response.json();

        // Schema validation
        expect(data).toHaveProperty("status");
        expect(data).toHaveProperty("uptime");
        expect(data).toHaveProperty("timestamp");

        // No extra fields (only status, uptime, timestamp)
        const keys = Object.keys(data);
        expect(keys.sort()).toEqual(["status", "timestamp", "uptime"].sort());
    });

    it("timestamp format includes milliseconds and Z suffix", async () => {
        const response = await GET();
        const data = await response.json();

        // ISO 8601 format with milliseconds: YYYY-MM-DDTHH:mm:ss.sssZ
        const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
        expect(data.timestamp).toMatch(iso8601Pattern);
    });

    it("uptime increases over time", async () => {
        const response1 = await GET();
        const data1 = await response1.json();

        // Wait 100ms
        await new Promise((resolve) => setTimeout(resolve, 100));

        const response2 = await GET();
        const data2 = await response2.json();

        expect(data2.uptime).toBeGreaterThanOrEqual(data1.uptime);
    });
});
