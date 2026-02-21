import { ApiReference } from "@scalar/nextjs-api-reference";

const config = {
    spec: {
        url: "/api/docs/openapi.json"
    },
    theme: "kepler" as const,
    metaData: {
        title: "AgentC2 API Documentation",
        description: "API reference for the AgentC2 AI Agent Framework"
    }
};

export const GET = ApiReference(config);
