import type { HugeiconsProps } from "@hugeicons/react";

/**
 * Semantic icon names used throughout the application.
 * These names abstract away the underlying icon library.
 */
export type IconName =
    | "home"
    | "dashboard"
    | "settings"
    | "folder-open"
    | "shopping-cart"
    | "ai-network"
    | "chevron-down"
    | "search"
    | "sidebar-left"
    | "more-horizontal"
    | "user"
    | "logout"
    | "messages"
    | "file"
    | "folder"
    | "calendar"
    | "clock"
    | "lock"
    | "star"
    | "arrow-left"
    | "arrow-right"
    | "alert-triangle"
    | "alert-diamond"
    | "info-circle"
    | "checkmark-circle"
    | "tick"
    | "cancel"
    | "delete"
    | "refresh"
    | "test-tube"
    | "play-circle"
    | "analytics"
    | "activity"
    | "chart-evaluation"
    | "dollar"
    | "git-branch"
    | "shield"
    | "play-list"
    | "building"
    | "user-group"
    | "mail-send"
    | "add"
    | "menu";

/**
 * Icon component type - a reference to an icon component, not JSX.
 * Used for passing icons to configuration objects.
 */
export type IconComponent = HugeiconsProps["icon"];

/**
 * Props for the Icon wrapper component.
 */
export interface IconProps extends Omit<HugeiconsProps, "icon"> {
    name: IconName;
}
