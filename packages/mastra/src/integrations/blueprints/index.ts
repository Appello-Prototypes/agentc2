/**
 * Integration Blueprint Registry
 *
 * All blueprints are registered here and looked up by provider key.
 * Organized by category for maintainability.
 */

import type { IntegrationBlueprint } from "./types";

// Import blueprint collections by category
import { crmBlueprints } from "./crm";
import { productivityBlueprints } from "./productivity";
import { developerBlueprints } from "./developer";
import { communicationBlueprints } from "./communication";
import { financeBlueprints } from "./finance";
import { marketingBlueprints } from "./marketing";
import { designBlueprints } from "./design";
import { dataBlueprints, knowledgeBlueprints } from "./data";
import { emailBlueprints } from "./email";
import { automationBlueprints } from "./automation";

// ── Registry ─────────────────────────────────────────────────────────────────

const blueprintRegistry = new Map<string, IntegrationBlueprint>();

function registerBlueprints(blueprints: IntegrationBlueprint[]) {
    for (const bp of blueprints) {
        if (blueprintRegistry.has(bp.providerKey)) {
            console.warn(
                `[Blueprints] Duplicate blueprint for provider "${bp.providerKey}" — overwriting`
            );
        }
        blueprintRegistry.set(bp.providerKey, bp);
    }
}

// Register all blueprint collections
registerBlueprints(crmBlueprints);
registerBlueprints(productivityBlueprints);
registerBlueprints(developerBlueprints);
registerBlueprints(communicationBlueprints);
registerBlueprints(financeBlueprints);
registerBlueprints(marketingBlueprints);
registerBlueprints(designBlueprints);
registerBlueprints(dataBlueprints);
registerBlueprints(knowledgeBlueprints);
registerBlueprints(emailBlueprints);
registerBlueprints(automationBlueprints);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get a blueprint by provider key.
 */
export function getBlueprint(providerKey: string): IntegrationBlueprint | undefined {
    return blueprintRegistry.get(providerKey);
}

/**
 * Get all registered blueprints.
 */
export function getAllBlueprints(): IntegrationBlueprint[] {
    return Array.from(blueprintRegistry.values());
}

/**
 * Check if a blueprint exists for a provider.
 */
export function hasBlueprint(providerKey: string): boolean {
    return blueprintRegistry.has(providerKey);
}

/**
 * Get the count of registered blueprints.
 */
export function getBlueprintCount(): number {
    return blueprintRegistry.size;
}

// Re-export types
export type { IntegrationBlueprint, ProvisionResult } from "./types";
