import { Mastra } from "@mastra/core/mastra";
import { storage } from "./storage";
import { assistantAgent } from "./agents";
import { analysisWorkflow } from "./workflows";

// Extend global type for Next.js HMR singleton pattern
declare global {
  var mastraInstance: Mastra | undefined;
}

/**
 * Create Mastra instance with all agents, workflows, and storage.
 *
 * Includes telemetry configuration for observability:
 * - Console export in development (or OTLP if endpoint configured)
 * - 100% sampling in dev, 10% in production
 */
function getMastra(): Mastra {
  if (!global.mastraInstance) {
    const isDev = process.env.NODE_ENV !== "production";

    global.mastraInstance = new Mastra({
      agents: {
        assistant: assistantAgent,
      },
      workflows: {
        "analysis-workflow": analysisWorkflow,
      },
      storage,
      telemetry: {
        serviceName: "mastra-experiment",
        enabled: true,
        sampling: {
          type: isDev ? "always_on" : "ratio",
          probability: isDev ? undefined : 0.1,
        },
        export: {
          type: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? "otlp" : "console",
          endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
          headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
            ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
            : undefined,
        },
      },
    });
  }

  return global.mastraInstance;
}

export const mastra = getMastra();
