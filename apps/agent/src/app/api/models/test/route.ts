import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { authenticateRequest } from "@/lib/api-auth";
import { resolveModelForOrg, getOrgApiKey } from "@repo/agentc2/agents";

const DEFAULT_PROMPT = "Say hello in exactly 3 words.";

const DEFAULT_MODELS: Record<string, string> = {
    openai: "gpt-4o-mini",
    anthropic: "claude-sonnet-4-20250514",
    google: "gemini-2.0-flash",
    groq: "llama-3.3-70b-versatile",
    mistral: "mistral-small-latest",
    xai: "grok-2",
    deepseek: "deepseek-chat",
    togetherai: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    fireworks: "accounts/fireworks/models/llama-v3p1-8b-instruct",
    openrouter: "openai/gpt-4o-mini",
    kimi: "moonshot-v1-8k"
};

const ALL_PROVIDERS = Object.keys(DEFAULT_MODELS);

type TestResult = {
    provider: string;
    model: string;
    status: "ok" | "error" | "skipped";
    latency_ms: number | null;
    response_snippet: string | null;
    error: string | null;
};

async function testSingleModel(
    provider: string,
    modelId: string,
    prompt: string,
    organizationId: string
): Promise<TestResult> {
    const start = Date.now();
    try {
        const model = await resolveModelForOrg(provider, modelId, organizationId);
        if (!model) {
            return {
                provider,
                model: modelId,
                status: "skipped",
                latency_ms: null,
                response_snippet: null,
                error: `No API key configured for "${provider}". Add one via Settings > Integrations.`
            };
        }

        const result = await generateText({
            model,
            prompt,
            maxRetries: 1
        });

        const latency = Date.now() - start;
        return {
            provider,
            model: modelId,
            status: "ok",
            latency_ms: latency,
            response_snippet: result.text.slice(0, 200),
            error: null
        };
    } catch (err) {
        const latency = Date.now() - start;
        return {
            provider,
            model: modelId,
            status: "error",
            latency_ms: latency,
            response_snippet: null,
            error: err instanceof Error ? err.message : String(err)
        };
    }
}

/**
 * POST /api/models/test
 *
 * Test connectivity to AI models by sending a minimal prompt.
 *
 * Body: { provider: string, modelId?: string, prompt?: string }
 *   - provider: "openai", "anthropic", ..., or "all"
 *   - modelId: specific model to test (uses default if omitted)
 *   - prompt: custom prompt (default: "Say hello in exactly 3 words.")
 */
export async function POST(request: NextRequest) {
    const authContext = await authenticateRequest(request);
    if (!authContext) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const provider = (body.provider as string) || "";
    const modelId = body.modelId as string | undefined;
    const prompt = (body.prompt as string) || DEFAULT_PROMPT;

    if (!provider) {
        return NextResponse.json(
            { success: false, error: "'provider' is required" },
            { status: 400 }
        );
    }

    const results: TestResult[] = [];

    if (provider === "all") {
        const promises = ALL_PROVIDERS.map(async (p) => {
            const hasKey = await getOrgApiKey(p, authContext.organizationId);
            if (!hasKey) {
                return {
                    provider: p,
                    model: DEFAULT_MODELS[p]!,
                    status: "skipped" as const,
                    latency_ms: null,
                    response_snippet: null,
                    error: `No API key configured for "${p}".`
                };
            }
            return testSingleModel(p, DEFAULT_MODELS[p]!, prompt, authContext.organizationId);
        });
        results.push(...(await Promise.all(promises)));
    } else {
        if (!DEFAULT_MODELS[provider]) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Unknown provider "${provider}". Valid providers: ${ALL_PROVIDERS.join(", ")}, all`
                },
                { status: 400 }
            );
        }
        const testModel = modelId || DEFAULT_MODELS[provider]!;
        const result = await testSingleModel(
            provider,
            testModel,
            prompt,
            authContext.organizationId
        );
        results.push(result);
    }

    const summary = {
        total: results.length,
        ok: results.filter((r) => r.status === "ok").length,
        errors: results.filter((r) => r.status === "error").length,
        skipped: results.filter((r) => r.status === "skipped").length
    };

    return NextResponse.json({ success: true, summary, results });
}
