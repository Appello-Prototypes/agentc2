/**
 * Icon mapping layer - maps semantic icon names to library-specific components.
 * This is the ONLY file that directly imports from the icon library.
 *
 * When swapping icon libraries, only this file and index.tsx need to be updated.
 */
import {
    Activity01Icon,
    AiNetworkIcon,
    AlertDiamondIcon,
    Analytics01Icon,
    ArrowLeft01Icon,
    ArrowRight01Icon,
    CalendarIcon,
    Cancel01Icon,
    ChartEvaluationIcon,
    CheckmarkCircle02Icon,
    ChevronDown,
    ClockIcon,
    DashboardSpeed01Icon,
    Delete02Icon,
    Dollar01Icon,
    FileIcon,
    FolderIcon,
    FolderOpenIcon,
    GitBranchIcon,
    HomeIcon,
    InformationCircleIcon,
    LockIcon,
    Logout03Icon,
    MessageMultiple01Icon,
    MoreHorizontalIcon,
    PlayCircleIcon,
    RefreshIcon,
    Search01Icon,
    Settings02Icon,
    Shield01Icon,
    ShoppingCart01Icon,
    SidebarLeftIcon,
    StarIcon,
    TestTubeIcon,
    Tick02Icon,
    TriangleIcon,
    UserIcon
} from "@hugeicons/core-free-icons";

import type { IconComponent, IconName } from "./types";

/**
 * Maps semantic icon names to their corresponding icon components.
 */
export const iconMap: Record<IconName, IconComponent> = {
    home: HomeIcon,
    dashboard: DashboardSpeed01Icon,
    settings: Settings02Icon,
    "folder-open": FolderOpenIcon,
    "shopping-cart": ShoppingCart01Icon,
    "ai-network": AiNetworkIcon,
    "chevron-down": ChevronDown,
    search: Search01Icon,
    "sidebar-left": SidebarLeftIcon,
    "more-horizontal": MoreHorizontalIcon,
    user: UserIcon,
    logout: Logout03Icon,
    messages: MessageMultiple01Icon,
    file: FileIcon,
    folder: FolderIcon,
    calendar: CalendarIcon,
    clock: ClockIcon,
    lock: LockIcon,
    star: StarIcon,
    "arrow-left": ArrowLeft01Icon,
    "arrow-right": ArrowRight01Icon,
    "alert-triangle": TriangleIcon,
    "alert-diamond": AlertDiamondIcon,
    "info-circle": InformationCircleIcon,
    "checkmark-circle": CheckmarkCircle02Icon,
    tick: Tick02Icon,
    cancel: Cancel01Icon,
    delete: Delete02Icon,
    refresh: RefreshIcon,
    "test-tube": TestTubeIcon,
    "play-circle": PlayCircleIcon,
    analytics: Analytics01Icon,
    activity: Activity01Icon,
    "chart-evaluation": ChartEvaluationIcon,
    dollar: Dollar01Icon,
    "git-branch": GitBranchIcon,
    shield: Shield01Icon
};
