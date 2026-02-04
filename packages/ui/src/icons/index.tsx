/**
 * Centralized icon system for the UI library.
 *
 * This module provides a wrapper around the icon library that makes it easy
 * to swap icon libraries in the future by centralizing all icon imports.
 *
 * Usage:
 * - Semantic: <Icon name="home" className="size-6" />
 * - Reference: const config = { icon: icons.home }
 */
import { HugeiconsIcon } from "@hugeicons/react";
import type { HugeiconsProps } from "@hugeicons/react";

import { iconMap } from "./icon-map";
import type { IconComponent, IconName, IconProps } from "./types";

/**
 * Icon wrapper component for semantic usage.
 *
 * @example
 * <Icon name="home" className="size-6" />
 * <Icon name="settings" className="size-5 text-muted-foreground" />
 */
export function Icon({ name, ...props }: IconProps) {
    const IconComponent = iconMap[name]!;
    return <HugeiconsIcon icon={IconComponent} {...props} />;
}

/**
 * Object containing all available icon components.
 * Use this for passing icon references to configuration objects.
 *
 * @example
 * const navigationConfig = {
 *   icon: icons.home,  // Component reference, not JSX
 *   label: "Home"
 * }
 */
export const icons = iconMap;

// Re-export types and HugeIcons components for backward compatibility
export type { IconComponent, IconName, IconProps, HugeiconsProps };
export { HugeiconsIcon };

// Custom logo components
export { AgentC2Logo } from "./agent-c2-logo";
