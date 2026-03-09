import { describe, it, expect } from "vitest";

describe("GET /api/health", () => {
    it("should return 200 status", async () => {
        const response = await fetch("http://localhost:3001/api/health");
        expect(response.status).toBe(200);
    });

    it("should include required fields", async () => {
        const response = await fetch("http://localhost:3001/api/health");
        const body = await response.json();

        expect(body).toHaveProperty("status", "ok");
        expect(body).toHaveProperty("uptime");
        expect(body).toHaveProperty("timestamp");
    });

    it("should return uptime as a positive number", async () => {
        const response = await fetch("http://localhost:3001/api/health");
        const body = await response.json();

        expect(typeof body.uptime).toBe("number");
        expect(body.uptime).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(body.uptime)).toBe(true);
    });

    it("should return valid ISO timestamp", async () => {
        const response = await fetch("http://localhost:3001/api/health");
        const body = await response.json();

        expect(typeof body.timestamp).toBe("string");
        const timestamp = new Date(body.timestamp);
        expect(timestamp.toISOString()).toBe(body.timestamp);
    });

    it("should return increasing uptime on subsequent calls", async () => {
        const response1 = await fetch("http://localhost:3001/api/health");
        const body1 = await response1.json();

        await new Promise((resolve) => setTimeout(resolve, 1100));

        const response2 = await fetch("http://localhost:3001/api/health");
        const body2 = await response2.json();

        expect(body2.uptime).toBeGreaterThanOrEqual(body1.uptime);
    });
});
