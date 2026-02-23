import type { PlaybookManifest } from "./types";

const SECRET_PATTERNS = [
    /sk-[a-zA-Z0-9]{20,}/g, // OpenAI
    /sk-ant-[a-zA-Z0-9-]{20,}/g, // Anthropic
    /pat-na1-[a-zA-Z0-9-]{20,}/g, // HubSpot
    /xoxb-[a-zA-Z0-9-]+/g, // Slack bot token
    /xoxp-[a-zA-Z0-9-]+/g, // Slack user token
    /ghp_[a-zA-Z0-9]{36,}/g, // GitHub PAT
    /gho_[a-zA-Z0-9]{36,}/g, // GitHub OAuth
    /fc-[a-zA-Z0-9]{20,}/g, // Firecrawl
    /ATATT3x[a-zA-Z0-9+/=]{20,}/g, // Jira/Atlassian
    /sk_[a-zA-Z0-9]{20,}/g, // ElevenLabs / generic
    /Bearer\s+[a-zA-Z0-9._\-+/=]{20,}/gi, // Bearer tokens
    /api[_-]?key[_-]?[=:]\s*["']?[a-zA-Z0-9._\-+/=]{16,}/gi, // Generic api_key=...
    /password[_-]?[=:]\s*["']?[^\s"']{8,}/gi // password=...
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;

const ORG_ID_PATTERN = /[a-z]{1,10}_[a-zA-Z0-9]{20,30}/g;
const CONNECTION_ID_PATTERN = /conn_[a-zA-Z0-9]{20,}/g;

function stripSecretsFromString(value: string): string {
    let result = value;
    for (const pattern of SECRET_PATTERNS) {
        result = result.replace(pattern, "{{REDACTED_SECRET}}");
    }
    return result;
}

function stripPiiFromString(value: string): string {
    let result = value;
    result = result.replace(EMAIL_PATTERN, "{{REDACTED_EMAIL}}");
    result = result.replace(PHONE_PATTERN, "{{REDACTED_PHONE}}");
    return result;
}

function stripOrgSpecificIds(value: string, orgId: string): string {
    let result = value;
    if (orgId) {
        result = result.replaceAll(orgId, "{{ORGANIZATION_ID}}");
    }
    result = result.replace(CONNECTION_ID_PATTERN, "{{CONNECTION_ID}}");
    return result;
}

function sanitizeValue(value: unknown, orgId: string): unknown {
    if (typeof value === "string") {
        let result = stripSecretsFromString(value);
        result = stripPiiFromString(result);
        result = stripOrgSpecificIds(result, orgId);
        return result;
    }
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, orgId));
    }
    if (value !== null && typeof value === "object") {
        return sanitizeObject(value as Record<string, unknown>, orgId);
    }
    return value;
}

function sanitizeObject(obj: Record<string, unknown>, orgId: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        result[key] = sanitizeValue(value, orgId);
    }
    return result;
}

export interface SanitizationResult {
    manifest: PlaybookManifest;
    warnings: string[];
}

export function sanitizeManifest(manifest: PlaybookManifest, orgId: string): SanitizationResult {
    const warnings: string[] = [];

    const sanitized: PlaybookManifest = {
        ...manifest,
        agents: manifest.agents.map((agent) => {
            let instructions = stripSecretsFromString(agent.instructions);
            instructions = stripOrgSpecificIds(instructions, orgId);

            if (instructions.includes("{{REDACTED_SECRET}}")) {
                warnings.push(
                    `Agent "${agent.slug}" instructions contain secrets that were redacted`
                );
            }

            return {
                ...agent,
                instructions,
                instructionsTemplate: agent.instructionsTemplate
                    ? stripOrgSpecificIds(stripSecretsFromString(agent.instructionsTemplate), orgId)
                    : null,
                metadata: agent.metadata ? sanitizeValue(agent.metadata, orgId) : null,
                guardrail: agent.guardrail
                    ? {
                          ...agent.guardrail,
                          configJson: sanitizeValue(agent.guardrail.configJson, orgId)
                      }
                    : null
            };
        }),
        skills: manifest.skills.map((skill) => ({
            ...skill,
            instructions: stripOrgSpecificIds(stripSecretsFromString(skill.instructions), orgId),
            metadata: skill.metadata ? sanitizeValue(skill.metadata, orgId) : null
        })),
        documents: manifest.documents.map((doc) => {
            let content = stripSecretsFromString(doc.content);
            content = stripPiiFromString(content);
            content = stripOrgSpecificIds(content, orgId);

            if (content.includes("{{REDACTED_SECRET}}")) {
                warnings.push(`Document "${doc.slug}" contains secrets that were redacted`);
            }

            return {
                ...doc,
                content,
                metadata: doc.metadata ? sanitizeValue(doc.metadata, orgId) : null
            };
        }),
        workflows: manifest.workflows.map((wf) => ({
            ...wf,
            definitionJson: sanitizeValue(wf.definitionJson, orgId),
            inputSchemaJson: wf.inputSchemaJson ? sanitizeValue(wf.inputSchemaJson, orgId) : null,
            outputSchemaJson: wf.outputSchemaJson
                ? sanitizeValue(wf.outputSchemaJson, orgId)
                : null,
            retryConfig: wf.retryConfig ? sanitizeValue(wf.retryConfig, orgId) : null
        })),
        networks: manifest.networks.map((net) => ({
            ...net,
            instructions: stripOrgSpecificIds(stripSecretsFromString(net.instructions), orgId),
            topologyJson: sanitizeValue(net.topologyJson, orgId),
            memoryConfig: sanitizeValue(net.memoryConfig, orgId)
        }))
    };

    return { manifest: sanitized, warnings };
}

export function detectHardcodedUrls(manifest: PlaybookManifest): string[] {
    const warnings: string[] = [];
    const suspiciousUrlPattern =
        /https?:\/\/[a-z0-9-]+\.(hubspot|salesforce|atlassian|zendesk|intercom)\.(com|net|io)/gi;

    function checkString(value: string, context: string) {
        const matches = value.match(suspiciousUrlPattern);
        if (matches) {
            warnings.push(`${context} contains builder-specific URL: ${matches.join(", ")}`);
        }
    }

    function checkValue(value: unknown, context: string) {
        if (typeof value === "string") {
            checkString(value, context);
        } else if (Array.isArray(value)) {
            value.forEach((item, i) => checkValue(item, `${context}[${i}]`));
        } else if (value !== null && typeof value === "object") {
            for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
                checkValue(v, `${context}.${key}`);
            }
        }
    }

    for (const agent of manifest.agents) {
        checkString(agent.instructions, `Agent "${agent.slug}" instructions`);
        if (agent.metadata) checkValue(agent.metadata, `Agent "${agent.slug}" metadata`);
    }
    for (const skill of manifest.skills) {
        checkString(skill.instructions, `Skill "${skill.slug}" instructions`);
    }
    for (const doc of manifest.documents) {
        checkString(doc.content, `Document "${doc.slug}" content`);
    }

    return warnings;
}
