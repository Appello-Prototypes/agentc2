import { describe, it, expect } from "vitest";
import { agentCreateSchema, agentUpdateSchema } from "../../../packages/agentc2/src/schemas/agent";
import { networkCreateSchema } from "../../../packages/agentc2/src/schemas/network";

describe("Agents API - modelName Validation (Issue #127)", () => {
    describe("agentCreateSchema", () => {
        it("should reject null modelName", () => {
            const result = agentCreateSchema.safeParse({
                name: "Test Agent",
                instructions: "Do something",
                modelProvider: "openai",
                modelName: null
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues).toHaveLength(1);
                expect(result.error.issues[0].path).toContain("modelName");
                expect(result.error.issues[0].message).toContain("Expected string, received null");
            }
        });

        it("should reject missing modelName", () => {
            const result = agentCreateSchema.safeParse({
                name: "Test Agent",
                instructions: "Do something",
                modelProvider: "openai"
                // modelName is missing
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((issue) => issue.path.includes("modelName"))).toBe(
                    true
                );
            }
        });

        it("should reject empty string modelName", () => {
            const result = agentCreateSchema.safeParse({
                name: "Test Agent",
                instructions: "Do something",
                modelProvider: "openai",
                modelName: ""
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((issue) => issue.path.includes("modelName"))).toBe(
                    true
                );
            }
        });

        it("should reject wrong type (number) for modelName", () => {
            const result = agentCreateSchema.safeParse({
                name: "Test Agent",
                instructions: "Do something",
                modelProvider: "openai",
                modelName: 123
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((issue) => issue.path.includes("modelName"))).toBe(
                    true
                );
            }
        });

        it("should accept valid modelName", () => {
            const result = agentCreateSchema.safeParse({
                name: "Test Agent",
                instructions: "Do something",
                modelProvider: "openai",
                modelName: "gpt-4o"
            });

            expect(result.success).toBe(true);
        });
    });

    describe("networkCreateSchema", () => {
        it("should reject null modelName", () => {
            const result = networkCreateSchema.safeParse({
                name: "Test Network",
                instructions: "Route tasks",
                modelProvider: "openai",
                modelName: null,
                topologyJson: { nodes: [], edges: [] }
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((issue) => issue.path.includes("modelName"))).toBe(
                    true
                );
            }
        });

        it("should reject missing modelName", () => {
            const result = networkCreateSchema.safeParse({
                name: "Test Network",
                instructions: "Route tasks",
                modelProvider: "openai"
                // modelName is missing
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((issue) => issue.path.includes("modelName"))).toBe(
                    true
                );
            }
        });

        it("should accept valid modelName", () => {
            const result = networkCreateSchema.safeParse({
                name: "Test Network",
                instructions: "Route tasks",
                modelProvider: "openai",
                modelName: "gpt-4o"
            });

            expect(result.success).toBe(true);
        });
    });

    describe("agentUpdateSchema", () => {
        it("should allow partial updates without modelName", () => {
            const result = agentUpdateSchema.safeParse({
                name: "Updated Agent"
                // modelName not provided - should be allowed for updates
            });

            expect(result.success).toBe(true);
        });

        it("should reject null modelName in updates", () => {
            const result = agentUpdateSchema.safeParse({
                name: "Updated Agent",
                modelName: null
            });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((issue) => issue.path.includes("modelName"))).toBe(
                    true
                );
            }
        });

        it("should accept valid modelName in updates", () => {
            const result = agentUpdateSchema.safeParse({
                name: "Updated Agent",
                modelName: "claude-sonnet-4-20250514"
            });

            expect(result.success).toBe(true);
        });
    });
});
