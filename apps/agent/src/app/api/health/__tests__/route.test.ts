import { GET } from "../route";

describe("GET /api/health", () => {
    it("should return 200 status", async () => {
        const response = await GET();
        expect(response.status).toBe(200);
    });

    it("should include required fields", async () => {
        const response = await GET();
        const body = await response.json();

        expect(body).toHaveProperty("status", "ok");
        expect(body).toHaveProperty("uptime");
        expect(body).toHaveProperty("timestamp");
    });

    it("should return uptime as a positive number", async () => {
        const response = await GET();
        const body = await response.json();

        expect(typeof body.uptime).toBe("number");
        expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should return valid ISO timestamp", async () => {
        const response = await GET();
        const body = await response.json();

        expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it("should return process uptime", async () => {
        const response = await GET();
        const body = await response.json();

        const processUptime = Math.floor(process.uptime());
        expect(body.uptime).toBeGreaterThanOrEqual(0);
        expect(body.uptime).toBeLessThanOrEqual(processUptime + 1);
    });
});
