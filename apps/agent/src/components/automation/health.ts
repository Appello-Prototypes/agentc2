import {
    getHealthStatus,
    getHealthStyles,
    healthSortOrder,
    type HealthStatus
} from "@repo/ui/lib/health";

export function getAutomationHealth(successRate: number): HealthStatus {
    return getHealthStatus(successRate);
}

export function getAutomationHealthStyles(successRate: number) {
    return getHealthStyles(getHealthStatus(successRate));
}

export { getHealthStatus, getHealthStyles, healthSortOrder, type HealthStatus };
