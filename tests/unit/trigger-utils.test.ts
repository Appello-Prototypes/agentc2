import { describe, it, expect } from "vitest";
import { matchesTriggerFilter, resolveTriggerInput } from "../../apps/agent/src/lib/trigger-utils";

describe("trigger-utils", () => {
    it("matches simple filters", () => {
        const payload = { type: "lead", value: 10 };
        expect(matchesTriggerFilter(payload, { type: "lead" })).toBe(true);
        expect(matchesTriggerFilter(payload, { type: "customer" })).toBe(false);
    });

    it("matches nested filters", () => {
        const payload = { user: { tier: "pro" } };
        expect(matchesTriggerFilter(payload, { "user.tier": "pro" })).toBe(true);
        expect(matchesTriggerFilter(payload, { "user.tier": "free" })).toBe(false);
    });

    it("matches array filters and keywords", () => {
        const payload = {
            senderType: "external",
            tags: ["priority", "ops"],
            subject: "Urgent: system alert",
            snippet: "Immediate attention required"
        };
        expect(matchesTriggerFilter(payload, { senderType: ["internal", "external"] })).toBe(true);
        expect(matchesTriggerFilter(payload, { tags: ["ops"] })).toBe(true);
        expect(matchesTriggerFilter(payload, { keywords: ["urgent"] })).toBe(true);
    });

    it("matches ccIncludes filters", () => {
        const payload = {
            cc: "Jane Doe <jane@example.com>, ops@example.com"
        };
        expect(matchesTriggerFilter(payload, { ccIncludes: ["jane@example.com"] })).toBe(true);
        expect(matchesTriggerFilter(payload, { ccIncludes: ["sales@example.com"] })).toBe(false);
    });

    it("matches businessHours filters", () => {
        const payload = { receivedAt: "2025-01-01T10:00:00Z" };
        expect(
            matchesTriggerFilter(payload, {
                businessHours: { start: 9, end: 17, timezone: "UTC", enabled: true }
            })
        ).toBe(true);
        expect(
            matchesTriggerFilter(payload, {
                businessHours: { start: 9, end: 17, timezone: "UTC", enabled: false }
            })
        ).toBe(false);
    });

    it("resolves input with template", () => {
        const payload = { name: "Alex" };
        const input = resolveTriggerInput(payload, { template: "Lead {{name}}" });
        expect(input).toBe("Lead Alex");
    });

    it("resolves input with jsonPath", () => {
        const payload = { user: { name: "Sam" } };
        const input = resolveTriggerInput(payload, { jsonPath: "user.name" });
        expect(input).toBe("Sam");
    });
});
