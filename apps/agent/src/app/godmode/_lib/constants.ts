export const POLL_INTERVAL_MS = 3000;

export const EVENT_TYPE_CONFIG: Record<
    string,
    { label: string; color: string; bgColor: string; icon: string }
> = {
    RUN_STARTED: {
        label: "Run Started",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/30",
        icon: "play-circle"
    },
    RUN_COMPLETED: {
        label: "Run Completed",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        icon: "checkmark-circle-02"
    },
    RUN_FAILED: {
        label: "Run Failed",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        icon: "cancel-circle"
    },
    WORKFLOW_STARTED: {
        label: "Workflow Started",
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
        icon: "workflow-square-10"
    },
    WORKFLOW_COMPLETED: {
        label: "Workflow Completed",
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
        icon: "checkmark-circle-02"
    },
    WORKFLOW_FAILED: {
        label: "Workflow Failed",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        icon: "cancel-circle"
    },
    WORKFLOW_SUSPENDED: {
        label: "Workflow Suspended",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        icon: "pause-circle"
    },
    NETWORK_ROUTED: {
        label: "Network Routed",
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-50 dark:bg-violet-950/30",
        icon: "share-knowledge"
    },
    NETWORK_COMPLETED: {
        label: "Network Completed",
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-50 dark:bg-violet-950/30",
        icon: "checkmark-circle-02"
    },
    TASK_CREATED: {
        label: "Task Created",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/30",
        icon: "task-01"
    },
    TASK_COMPLETED: {
        label: "Task Completed",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        icon: "task-done-01"
    },
    TASK_FAILED: {
        label: "Task Failed",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        icon: "task-remove-01"
    },
    SLACK_MESSAGE_HANDLED: {
        label: "Slack Message",
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-50 dark:bg-purple-950/30",
        icon: "message-01"
    },
    EMAIL_PROCESSED: {
        label: "Email Processed",
        color: "text-sky-600 dark:text-sky-400",
        bgColor: "bg-sky-50 dark:bg-sky-950/30",
        icon: "mail-01"
    },
    CAMPAIGN_STARTED: {
        label: "Campaign Started",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        icon: "megaphone-01"
    },
    CAMPAIGN_COMPLETED: {
        label: "Campaign Done",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
        icon: "megaphone-01"
    },
    TRIGGER_FIRED: {
        label: "Trigger Fired",
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
        icon: "flash"
    },
    SCHEDULE_EXECUTED: {
        label: "Scheduled Run",
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-teal-50 dark:bg-teal-950/30",
        icon: "clock-01"
    },
    HEARTBEAT_RAN: {
        label: "Heartbeat",
        color: "text-gray-500 dark:text-gray-400",
        bgColor: "bg-gray-50 dark:bg-gray-950/30",
        icon: "activity-01"
    },
    HEARTBEAT_ALERT: {
        label: "Alert",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/30",
        icon: "alert-circle"
    },
    GUARDRAIL_TRIGGERED: {
        label: "Guardrail",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/30",
        icon: "shield-01"
    }
};

export const DEFAULT_EVENT_CONFIG = {
    label: "Event",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-950/30",
    icon: "information-circle"
};

export const AGENT_COLORS = [
    "from-blue-500 to-cyan-500",
    "from-violet-500 to-purple-500",
    "from-emerald-500 to-teal-500",
    "from-rose-500 to-pink-500",
    "from-amber-500 to-orange-500",
    "from-indigo-500 to-blue-500",
    "from-fuchsia-500 to-pink-500",
    "from-lime-500 to-green-500"
];

export const NODE_TYPE_STYLES: Record<string, { color: string; bg: string; border: string }> = {
    trigger: {
        color: "text-yellow-700 dark:text-yellow-400",
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        border: "border-yellow-300 dark:border-yellow-700"
    },
    network: {
        color: "text-violet-700 dark:text-violet-400",
        bg: "bg-violet-50 dark:bg-violet-950/30",
        border: "border-violet-300 dark:border-violet-700"
    },
    network_step: {
        color: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50/50 dark:bg-violet-950/20",
        border: "border-violet-200 dark:border-violet-800"
    },
    workflow: {
        color: "text-indigo-700 dark:text-indigo-400",
        bg: "bg-indigo-50 dark:bg-indigo-950/30",
        border: "border-indigo-300 dark:border-indigo-700"
    },
    workflow_step: {
        color: "text-indigo-600 dark:text-indigo-400",
        bg: "bg-indigo-50/50 dark:bg-indigo-950/20",
        border: "border-indigo-200 dark:border-indigo-800"
    },
    agent_run: {
        color: "text-blue-700 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-300 dark:border-blue-700"
    },
    tool_call: {
        color: "text-amber-700 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800"
    }
};
