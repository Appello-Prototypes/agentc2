import { describe, it, expect } from "vitest";
import { validateManifest, isValidManifest } from "../../../packages/agentc2/src/playbooks/manifest";
import type { PlaybookManifest } from "../../../packages/agentc2/src/playbooks/types";

describe("Deployer Edge Cases - Manifest Validation", () => {
    it("should reject manifest with undefined entryPoint", () => {
        const invalidManifest = {
            version: "1.0",
            agents: [
                {
                    slug: "test-agent",
                    name: "Test Agent",
                    description: "Test",
                    instructions: "Test instructions",
                    instructionsTemplate: null,
                    modelProvider: "openai",
                    modelName: "gpt-4o",
                    temperature: 0.7,
                    maxTokens: null,
                    modelConfig: null,
                    routingConfig: null,
                    contextConfig: null,
                    subAgents: [],
                    workflows: [],
                    memoryEnabled: false,
                    memoryConfig: null,
                    maxSteps: 3,
                    visibility: "PRIVATE",
                    requiresApproval: false,
                    maxSpendUsd: null,
                    autoVectorize: false,
                    deploymentMode: null,
                    metadata: null,
                    version: 1,
                    tools: [],
                    skills: [],
                    guardrail: null,
                    testCases: [],
                    scorecard: null
                }
            ],
            skills: [],
            documents: [],
            workflows: [],
            networks: [],
            campaignTemplates: [],
            guardrails: [],
            testCases: [],
            scorecards: [],
            requiredIntegrations: []
        };

        expect(() => validateManifest(invalidManifest)).toThrow();
        expect(isValidManifest(invalidManifest)).toBe(false);
    });

    it("should reject manifest with null entryPoint", () => {
        const invalidManifest = {
            version: "1.0",
            agents: [
                {
                    slug: "test-agent",
                    name: "Test Agent",
                    description: "Test",
                    instructions: "Test instructions",
                    instructionsTemplate: null,
                    modelProvider: "openai",
                    modelName: "gpt-4o",
                    temperature: 0.7,
                    maxTokens: null,
                    modelConfig: null,
                    routingConfig: null,
                    contextConfig: null,
                    subAgents: [],
                    workflows: [],
                    memoryEnabled: false,
                    memoryConfig: null,
                    maxSteps: 3,
                    visibility: "PRIVATE",
                    requiresApproval: false,
                    maxSpendUsd: null,
                    autoVectorize: false,
                    deploymentMode: null,
                    metadata: null,
                    version: 1,
                    tools: [],
                    skills: [],
                    guardrail: null,
                    testCases: [],
                    scorecard: null
                }
            ],
            skills: [],
            documents: [],
            workflows: [],
            networks: [],
            campaignTemplates: [],
            guardrails: [],
            testCases: [],
            scorecards: [],
            requiredIntegrations: [],
            entryPoint: null
        };

        expect(() => validateManifest(invalidManifest)).toThrow();
        expect(isValidManifest(invalidManifest)).toBe(false);
    });

    it("should accept manifest with valid entryPoint", () => {
        const validManifest: PlaybookManifest = {
            version: "1.0",
            agents: [
                {
                    slug: "test-agent",
                    name: "Test Agent",
                    description: "Test",
                    instructions: "Test instructions",
                    instructionsTemplate: null,
                    modelProvider: "openai",
                    modelName: "gpt-4o",
                    temperature: 0.7,
                    maxTokens: null,
                    modelConfig: null,
                    routingConfig: null,
                    contextConfig: null,
                    subAgents: [],
                    workflows: [],
                    memoryEnabled: false,
                    memoryConfig: null,
                    maxSteps: 3,
                    visibility: "PRIVATE",
                    requiresApproval: false,
                    maxSpendUsd: null,
                    autoVectorize: false,
                    deploymentMode: null,
                    metadata: null,
                    version: 1,
                    tools: [],
                    skills: [],
                    guardrail: null,
                    testCases: [],
                    scorecard: null
                }
            ],
            skills: [],
            documents: [],
            workflows: [],
            networks: [],
            campaignTemplates: [],
            guardrails: [],
            testCases: [],
            scorecards: [],
            requiredIntegrations: [],
            entryPoint: { type: "agent", slug: "test-agent" }
        };

        const result = validateManifest(validManifest);
        expect(result).toBeDefined();
        expect(result.entryPoint).toBeDefined();
        expect(result.entryPoint.type).toBe("agent");
        expect(result.entryPoint.slug).toBe("test-agent");
        expect(isValidManifest(validManifest)).toBe(true);
    });

    it("should reject manifest with invalid entryPoint type", () => {
        const invalidManifest = {
            version: "1.0",
            agents: [],
            skills: [],
            documents: [],
            workflows: [],
            networks: [],
            campaignTemplates: [],
            guardrails: [],
            testCases: [],
            scorecards: [],
            requiredIntegrations: [],
            entryPoint: { type: "invalid-type", slug: "test" }
        };

        expect(() => validateManifest(invalidManifest)).toThrow();
        expect(isValidManifest(invalidManifest)).toBe(false);
    });

    it("should reject manifest with missing entryPoint slug", () => {
        const invalidManifest = {
            version: "1.0",
            agents: [],
            skills: [],
            documents: [],
            workflows: [],
            networks: [],
            campaignTemplates: [],
            guardrails: [],
            testCases: [],
            scorecards: [],
            requiredIntegrations: [],
            entryPoint: { type: "agent" }
        };

        expect(() => validateManifest(invalidManifest)).toThrow();
        expect(isValidManifest(invalidManifest)).toBe(false);
    });
});
