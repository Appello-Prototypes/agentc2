import { createTool } from "@mastra/core/tools";
import { z } from "zod";

function getStripeKey(): string {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    return key;
}

async function stripeRequest(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, string>
): Promise<Record<string, unknown>> {
    const url = `https://api.stripe.com/v1${path}`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${getStripeKey()}`,
        "Content-Type": "application/x-www-form-urlencoded"
    };

    const init: RequestInit = { method, headers };
    if (body && method === "POST") {
        init.body = new URLSearchParams(body).toString();
    }

    const response = await fetch(url, init);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stripe API error (${response.status}): ${errorText}`);
    }
    return response.json() as Promise<Record<string, unknown>>;
}

/**
 * Stripe ACS Create Checkout Session — create a Stripe Checkout session for agent commerce.
 */
export const stripeAcsCreateSessionTool = createTool({
    id: "stripe-acs-create-session",
    description:
        "Create a Stripe Checkout session for agent-initiated purchases. Returns a checkout URL that can be shared with users for payment.",
    inputSchema: z.object({
        lineItems: z
            .array(
                z.object({
                    priceId: z.string().describe("Stripe Price ID"),
                    quantity: z.number().default(1).describe("Quantity")
                })
            )
            .min(1)
            .describe("Line items for the checkout session"),
        successUrl: z.string().url().describe("URL to redirect after successful payment"),
        cancelUrl: z.string().url().describe("URL to redirect if payment is cancelled"),
        customerEmail: z.string().email().optional().describe("Pre-fill customer email"),
        metadata: z
            .record(z.string())
            .optional()
            .describe("Metadata to attach to the session (e.g. agentId, runId)")
    }),
    outputSchema: z.object({
        sessionId: z.string(),
        checkoutUrl: z.string(),
        status: z.string()
    }),
    execute: async ({ lineItems, successUrl, cancelUrl, customerEmail, metadata }) => {
        const body: Record<string, string> = {
            mode: "payment",
            success_url: successUrl,
            cancel_url: cancelUrl
        };

        lineItems.forEach((item, i) => {
            body[`line_items[${i}][price]`] = item.priceId;
            body[`line_items[${i}][quantity]`] = String(item.quantity);
        });

        if (customerEmail) body.customer_email = customerEmail;
        if (metadata) {
            for (const [key, value] of Object.entries(metadata)) {
                body[`metadata[${key}]`] = value;
            }
        }

        const data = await stripeRequest("/checkout/sessions", "POST", body);

        return {
            sessionId: data.id as string,
            checkoutUrl: data.url as string,
            status: data.status as string
        };
    }
});

/**
 * Stripe ACS Get Product — retrieve product details for agent commerce decisions.
 */
export const stripeAcsGetProductTool = createTool({
    id: "stripe-acs-get-product",
    description:
        "Get details of a Stripe product including name, description, and pricing. Use to look up product info before creating checkout sessions.",
    inputSchema: z.object({
        productId: z.string().describe("Stripe Product ID (prod_...)")
    }),
    outputSchema: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        active: z.boolean(),
        defaultPrice: z.string().optional(),
        metadata: z.record(z.string()).optional()
    }),
    execute: async ({ productId }) => {
        const data = await stripeRequest(`/products/${productId}`);

        return {
            id: data.id as string,
            name: data.name as string,
            description: (data.description as string) || undefined,
            active: data.active as boolean,
            defaultPrice: (data.default_price as string) || undefined,
            metadata: data.metadata as Record<string, string> | undefined
        };
    }
});

/**
 * Stripe ACS List Products — browse available products for agent commerce.
 */
export const stripeAcsListProductsTool = createTool({
    id: "stripe-acs-list-products",
    description:
        "List available Stripe products. Use to discover what products and services are available for agent-initiated purchases.",
    inputSchema: z.object({
        active: z.boolean().optional().default(true).describe("Only show active products"),
        limit: z.number().optional().default(10).describe("Maximum number of products to return")
    }),
    outputSchema: z.object({
        products: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().optional(),
                active: z.boolean(),
                defaultPrice: z.string().optional()
            })
        ),
        resultCount: z.number(),
        hasMore: z.boolean()
    }),
    execute: async ({ active, limit }) => {
        const params = new URLSearchParams({
            active: String(active),
            limit: String(Math.min(limit ?? 10, 100))
        });

        const data = await stripeRequest(`/products?${params.toString()}`);
        const rawProducts = (data.data as Array<Record<string, unknown>>) || [];

        const products = rawProducts.map((p) => ({
            id: p.id as string,
            name: p.name as string,
            description: (p.description as string) || undefined,
            active: p.active as boolean,
            defaultPrice: (p.default_price as string) || undefined
        }));

        return {
            products,
            resultCount: products.length,
            hasMore: data.has_more as boolean
        };
    }
});
