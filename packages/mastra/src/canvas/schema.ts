/**
 * Canvas Schema Specification
 *
 * Defines the JSON structure that agents generate and the renderer consumes.
 * This is the contract between the AI builder and the UI renderer.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Data Query Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const DataQuerySourceSchema = z.enum(["mcp", "sql", "rag", "static", "agent", "api"]);

export type DataQuerySource = z.infer<typeof DataQuerySourceSchema>;

export const DataQuerySchema = z.object({
    id: z.string().describe("Unique identifier for this query, referenced by components"),
    source: DataQuerySourceSchema.describe("The data source type"),
    // MCP source fields
    tool: z.string().optional().describe("MCP tool name (e.g., 'hubspot.hubspot-search-objects')"),
    params: z.record(z.unknown()).optional().describe("Parameters to pass to the data source"),
    // SQL source fields
    query: z.string().optional().describe("SQL query string (only for 'sql' source)"),
    // Static source fields
    data: z.unknown().optional().describe("Static data payload (only for 'static' source)"),
    // Agent source fields
    agentSlug: z.string().optional().describe("Agent slug to query (only for 'agent' source)"),
    prompt: z.string().optional().describe("Prompt to send to the agent (only for 'agent' source)"),
    // API source fields
    url: z.string().optional().describe("API URL (only for 'api' source)"),
    method: z.string().optional().describe("HTTP method (only for 'api' source)"),
    headers: z.record(z.string()).optional().describe("HTTP headers (only for 'api' source)"),
    body: z.unknown().optional().describe("Request body (only for 'api' source)"),
    // Refresh configuration
    refreshInterval: z
        .number()
        .optional()
        .describe("Auto-refresh interval in milliseconds (0 = no refresh)"),
    // Transform
    transform: z
        .string()
        .optional()
        .describe("Expression to transform results (e.g., '{{ data.results }}')")
});

export type DataQuery = z.infer<typeof DataQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Column / Field Definitions (shared across block types)
// ─────────────────────────────────────────────────────────────────────────────

export const ColumnFormatSchema = z.enum([
    "text",
    "number",
    "currency",
    "percent",
    "date",
    "datetime",
    "boolean",
    "badge",
    "link",
    "image"
]);

export type ColumnFormat = z.infer<typeof ColumnFormatSchema>;

export const TableColumnSchema = z.object({
    key: z.string().describe("Property key in the data object"),
    label: z.string().describe("Display header label"),
    format: ColumnFormatSchema.optional().default("text"),
    sortable: z.boolean().optional().default(false),
    width: z.string().optional().describe("CSS width (e.g., '200px', '20%')"),
    align: z.enum(["left", "center", "right"]).optional().default("left"),
    hidden: z.boolean().optional().default(false)
});

export type TableColumn = z.infer<typeof TableColumnSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Action Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const ActionSchema = z.object({
    label: z.string(),
    type: z.enum(["link", "tool", "navigate"]),
    href: z.string().optional().describe("URL or expression for link actions"),
    tool: z.string().optional().describe("Tool name for tool actions"),
    toolParams: z.record(z.unknown()).optional(),
    target: z.string().optional().describe("Navigation target for navigate actions"),
    icon: z.string().optional(),
    variant: z.enum(["default", "outline", "ghost", "destructive"]).optional().default("default")
});

export type Action = z.infer<typeof ActionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Block Type Definitions (Phase 1: 5 core blocks)
// ─────────────────────────────────────────────────────────────────────────────

/** Base properties shared by all blocks */
const BlockBaseSchema = z.object({
    id: z.string().describe("Unique block identifier"),
    span: z.number().min(1).max(12).default(12).describe("Grid column span (1-12)"),
    title: z.string().optional().describe("Block title/header"),
    description: z.string().optional().describe("Subtitle or description"),
    hidden: z.boolean().optional().default(false),
    className: z.string().optional().describe("Additional CSS classes"),
    row: z
        .string()
        .optional()
        .describe(
            "Optional row group identifier. Components with the same row value are rendered together in the same visual row."
        )
});

/** DataTable block - sortable, filterable table */
export const DataTableBlockSchema = BlockBaseSchema.extend({
    type: z.literal("data-table"),
    data: z.string().describe("Expression referencing query data (e.g., '{{ queries.deals }}')"),
    columns: z.array(TableColumnSchema).describe("Column definitions"),
    actions: z.array(ActionSchema).optional().describe("Row-level actions"),
    pageSize: z.number().optional().default(10),
    searchable: z.boolean().optional().default(false),
    striped: z.boolean().optional().default(false),
    compact: z.boolean().optional().default(false),
    emptyMessage: z.string().optional().default("No data available")
});

export type DataTableBlock = z.infer<typeof DataTableBlockSchema>;

/** BarChart block - bar/column chart via Recharts */
export const BarChartBlockSchema = BlockBaseSchema.extend({
    type: z.literal("bar-chart"),
    data: z.string().describe("Expression referencing query data"),
    xAxis: z.string().describe("Data key for X axis"),
    yAxis: z.union([z.string(), z.array(z.string())]).describe("Data key(s) for Y axis"),
    orientation: z.enum(["vertical", "horizontal"]).optional().default("vertical"),
    stacked: z.boolean().optional().default(false),
    colors: z.array(z.string()).optional(),
    showLegend: z.boolean().optional().default(true),
    showGrid: z.boolean().optional().default(true),
    showTooltip: z.boolean().optional().default(true),
    yAxisLabel: z.string().optional(),
    xAxisLabel: z.string().optional(),
    height: z.number().optional().default(300)
});

export type BarChartBlock = z.infer<typeof BarChartBlockSchema>;

/** LineChart block */
export const LineChartBlockSchema = BlockBaseSchema.extend({
    type: z.literal("line-chart"),
    data: z.string().describe("Expression referencing query data"),
    xAxis: z.string().describe("Data key for X axis"),
    yAxis: z.union([z.string(), z.array(z.string())]).describe("Data key(s) for Y axis"),
    curved: z.boolean().optional().default(true),
    dots: z.boolean().optional().default(false),
    colors: z.array(z.string()).optional(),
    showLegend: z.boolean().optional().default(true),
    showGrid: z.boolean().optional().default(true),
    showTooltip: z.boolean().optional().default(true),
    height: z.number().optional().default(300)
});

export type LineChartBlock = z.infer<typeof LineChartBlockSchema>;

/** PieChart block */
export const PieChartBlockSchema = BlockBaseSchema.extend({
    type: z.literal("pie-chart"),
    data: z.string().describe("Expression referencing query data"),
    nameKey: z.string().describe("Data key for segment names"),
    valueKey: z.string().describe("Data key for segment values"),
    donut: z.boolean().optional().default(false),
    colors: z.array(z.string()).optional(),
    showLegend: z.boolean().optional().default(true),
    showTooltip: z.boolean().optional().default(true),
    showLabels: z.boolean().optional().default(false),
    height: z.number().optional().default(300)
});

export type PieChartBlock = z.infer<typeof PieChartBlockSchema>;

/** AreaChart block */
export const AreaChartBlockSchema = BlockBaseSchema.extend({
    type: z.literal("area-chart"),
    data: z.string().describe("Expression referencing query data"),
    xAxis: z.string().describe("Data key for X axis"),
    yAxis: z.union([z.string(), z.array(z.string())]).describe("Data key(s) for Y axis"),
    stacked: z.boolean().optional().default(false),
    gradient: z.boolean().optional().default(true),
    colors: z.array(z.string()).optional(),
    showLegend: z.boolean().optional().default(true),
    showGrid: z.boolean().optional().default(true),
    showTooltip: z.boolean().optional().default(true),
    height: z.number().optional().default(300)
});

export type AreaChartBlock = z.infer<typeof AreaChartBlockSchema>;

/** KPI Card block - single metric display */
export const KPICardBlockSchema = BlockBaseSchema.extend({
    type: z.literal("kpi-card"),
    value: z
        .string()
        .describe("Expression for the main value (e.g., '{{ sum(queries.deals, \"amount\") }}')"),
    format: ColumnFormatSchema.optional().default("text"),
    prefix: z.string().optional().describe("Value prefix (e.g., '$')"),
    suffix: z.string().optional().describe("Value suffix (e.g., '%')"),
    trend: z
        .object({
            value: z.string().describe("Expression for trend value"),
            direction: z.enum(["up", "down", "neutral"]).optional(),
            label: z.string().optional()
        })
        .optional(),
    icon: z.string().optional(),
    color: z
        .enum(["default", "blue", "green", "red", "yellow", "purple"])
        .optional()
        .default("default")
});

export type KPICardBlock = z.infer<typeof KPICardBlockSchema>;

/** Text block - markdown/rich text */
export const TextBlockSchema = BlockBaseSchema.extend({
    type: z.literal("text"),
    content: z.string().describe("Markdown content or expression"),
    variant: z
        .enum(["default", "muted", "info", "warning", "success", "error"])
        .optional()
        .default("default")
});

export type TextBlock = z.infer<typeof TextBlockSchema>;

/** FilterBar block - filter controls that update query params */
export const FilterBarBlockSchema = BlockBaseSchema.extend({
    type: z.literal("filter-bar"),
    filters: z.array(
        z.object({
            id: z.string().describe("Filter identifier"),
            label: z.string(),
            type: z.enum(["text", "select", "date", "dateRange", "number"]),
            queryId: z.string().describe("Which query this filter affects"),
            paramKey: z.string().describe("Which query parameter to update"),
            options: z
                .array(
                    z.object({
                        label: z.string(),
                        value: z.string()
                    })
                )
                .optional()
                .describe("Options for select filters"),
            defaultValue: z.unknown().optional(),
            placeholder: z.string().optional()
        })
    )
});

export type FilterBarBlock = z.infer<typeof FilterBarBlockSchema>;

/** DetailView block - single record view */
export const DetailViewBlockSchema = BlockBaseSchema.extend({
    type: z.literal("detail-view"),
    data: z.string().describe("Expression referencing a single record"),
    fields: z.array(
        z.object({
            key: z.string(),
            label: z.string(),
            format: ColumnFormatSchema.optional().default("text"),
            span: z
                .number()
                .optional()
                .default(6)
                .describe("Grid span within the detail view (1-12)")
        })
    ),
    actions: z.array(ActionSchema).optional()
});

export type DetailViewBlock = z.infer<typeof DetailViewBlockSchema>;

/** PropertyList block - key-value pairs */
export const PropertyListBlockSchema = BlockBaseSchema.extend({
    type: z.literal("property-list"),
    data: z.string().describe("Expression referencing data object"),
    properties: z
        .array(
            z.object({
                key: z.string(),
                label: z.string(),
                format: ColumnFormatSchema.optional().default("text")
            })
        )
        .optional()
        .describe("Explicit property list; if omitted, all keys are shown"),
    orientation: z.enum(["vertical", "horizontal"]).optional().default("vertical")
});

export type PropertyListBlock = z.infer<typeof PropertyListBlockSchema>;

/** Timeline block */
export const TimelineBlockSchema = BlockBaseSchema.extend({
    type: z.literal("timeline"),
    data: z.string().describe("Expression referencing array of events"),
    dateKey: z.string().describe("Key for event date/time"),
    titleKey: z.string().describe("Key for event title"),
    descriptionKey: z.string().optional().describe("Key for event description"),
    iconKey: z.string().optional(),
    colorKey: z.string().optional()
});

export type TimelineBlock = z.infer<typeof TimelineBlockSchema>;

/** Kanban block */
export const KanbanBlockSchema = BlockBaseSchema.extend({
    type: z.literal("kanban"),
    data: z.string().describe("Expression referencing array of items"),
    columnKey: z.string().describe("Key that determines which column an item belongs to"),
    columns: z.array(
        z.object({
            value: z.string(),
            label: z.string(),
            color: z.string().optional()
        })
    ),
    titleKey: z.string().describe("Key for card title"),
    descriptionKey: z.string().optional(),
    assigneeKey: z.string().optional()
});

export type KanbanBlock = z.infer<typeof KanbanBlockSchema>;

/** List block */
export const ListBlockSchema = BlockBaseSchema.extend({
    type: z.literal("list"),
    data: z.string().describe("Expression referencing array data"),
    titleKey: z.string().describe("Key for item title"),
    descriptionKey: z.string().optional(),
    imageKey: z.string().optional(),
    badgeKey: z.string().optional(),
    actions: z.array(ActionSchema).optional(),
    emptyMessage: z.string().optional().default("No items")
});

export type ListBlock = z.infer<typeof ListBlockSchema>;

/** Form block */
export const FormBlockSchema = BlockBaseSchema.extend({
    type: z.literal("form"),
    fields: z.array(
        z.object({
            name: z.string(),
            label: z.string(),
            type: z.enum([
                "text",
                "textarea",
                "number",
                "email",
                "select",
                "date",
                "checkbox",
                "radio"
            ]),
            required: z.boolean().optional().default(false),
            placeholder: z.string().optional(),
            defaultValue: z.unknown().optional(),
            options: z.array(z.object({ label: z.string(), value: z.string() })).optional()
        })
    ),
    submitAction: ActionSchema.describe("Action to perform on form submission"),
    submitLabel: z.string().optional().default("Submit")
});

export type FormBlock = z.infer<typeof FormBlockSchema>;

/** ActionButton block */
export const ActionButtonBlockSchema = BlockBaseSchema.extend({
    type: z.literal("action-button"),
    action: ActionSchema,
    size: z.enum(["sm", "md", "lg"]).optional().default("md"),
    fullWidth: z.boolean().optional().default(false)
});

export type ActionButtonBlock = z.infer<typeof ActionButtonBlockSchema>;

/** Search block */
export const SearchBlockSchema = BlockBaseSchema.extend({
    type: z.literal("search"),
    placeholder: z.string().optional().default("Search..."),
    queryId: z.string().describe("Which query to update with search text"),
    paramKey: z.string().describe("Which parameter of the query to set"),
    debounceMs: z.number().optional().default(300)
});

export type SearchBlock = z.infer<typeof SearchBlockSchema>;

/** Tabs layout block */
export const TabsBlockSchema = BlockBaseSchema.extend({
    type: z.literal("tabs"),
    tabs: z.array(
        z.object({
            id: z.string(),
            label: z.string(),
            icon: z.string().optional(),
            components: z.array(z.lazy(() => CanvasComponentSchema))
        })
    ),
    defaultTab: z.string().optional()
});

export type TabsBlock = z.infer<typeof TabsBlockSchema>;

/** Accordion layout block */
export const AccordionBlockSchema = BlockBaseSchema.extend({
    type: z.literal("accordion"),
    sections: z.array(
        z.object({
            id: z.string(),
            label: z.string(),
            defaultOpen: z.boolean().optional().default(false),
            components: z.array(z.lazy(() => CanvasComponentSchema))
        })
    ),
    allowMultiple: z.boolean().optional().default(false)
});

export type AccordionBlock = z.infer<typeof AccordionBlockSchema>;

/** Sparkline block - inline mini-chart */
export const SparklineBlockSchema = BlockBaseSchema.extend({
    type: z.literal("sparkline"),
    data: z.string().describe("Expression referencing array of numbers or objects"),
    valueKey: z.string().optional().describe("Key for values if data is array of objects"),
    chartType: z.enum(["line", "bar", "area"]).optional().default("line"),
    color: z.string().optional(),
    height: z.number().optional().default(40),
    width: z.number().optional().default(120),
    showDots: z.boolean().optional().default(false)
});

export type SparklineBlock = z.infer<typeof SparklineBlockSchema>;

/** Funnel block */
export const FunnelBlockSchema = BlockBaseSchema.extend({
    type: z.literal("funnel"),
    data: z.string().describe("Expression referencing funnel data"),
    nameKey: z.string().describe("Key for stage name"),
    valueKey: z.string().describe("Key for stage value"),
    colors: z.array(z.string()).optional(),
    showLabels: z.boolean().optional().default(true),
    showValues: z.boolean().optional().default(true),
    height: z.number().optional().default(300)
});

export type FunnelBlock = z.infer<typeof FunnelBlockSchema>;

/** ProgressBar block - horizontal progress indicator */
export const ProgressBarBlockSchema = BlockBaseSchema.extend({
    type: z.literal("progress-bar"),
    value: z.string().describe("Expression for current value"),
    max: z.number().optional().default(100).describe("Maximum value"),
    label: z.string().optional(),
    color: z.string().optional().describe("Bar fill color"),
    showPercentage: z.boolean().optional().default(true),
    height: z.number().optional().default(8).describe("Bar height in pixels")
});

export type ProgressBarBlock = z.infer<typeof ProgressBarBlockSchema>;

/** MetricRow block - horizontal row of small metrics */
export const MetricRowBlockSchema = BlockBaseSchema.extend({
    type: z.literal("metric-row"),
    metrics: z.array(
        z.object({
            label: z.string(),
            value: z.string().describe("Expression for the metric value"),
            format: ColumnFormatSchema.optional().default("text"),
            prefix: z.string().optional(),
            suffix: z.string().optional(),
            icon: z.string().optional()
        })
    )
});

export type MetricRowBlock = z.infer<typeof MetricRowBlockSchema>;

/** StatCard block - enhanced KPI card with icon and sparkline */
export const StatCardBlockSchema = BlockBaseSchema.extend({
    type: z.literal("stat-card"),
    value: z.string().describe("Expression for the main value"),
    format: ColumnFormatSchema.optional().default("text"),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    trend: z
        .object({
            value: z.string().describe("Expression for trend value"),
            direction: z.enum(["up", "down", "neutral"]).optional(),
            label: z.string().optional()
        })
        .optional(),
    icon: z.string().optional().describe("Emoji or icon character"),
    color: z
        .enum(["default", "blue", "green", "red", "yellow", "purple"])
        .optional()
        .default("default"),
    sparklineData: z.string().optional().describe("Expression for sparkline data array"),
    sparklineType: z.enum(["line", "bar", "area"]).optional().default("line")
});

export type StatCardBlock = z.infer<typeof StatCardBlockSchema>;

/** Divider block - visual separator */
export const DividerBlockSchema = BlockBaseSchema.extend({
    type: z.literal("divider"),
    orientation: z.enum(["horizontal", "vertical"]).optional().default("horizontal"),
    label: z.string().optional().describe("Optional centered label on the divider")
});

export type DividerBlock = z.infer<typeof DividerBlockSchema>;

/** Image block - display images */
export const ImageBlockSchema = BlockBaseSchema.extend({
    type: z.literal("image"),
    src: z.string().describe("Image URL or expression"),
    alt: z.string().optional().default(""),
    fit: z.enum(["cover", "contain", "fill"]).optional().default("cover"),
    height: z.number().optional().default(200).describe("Image height in pixels")
});

export type ImageBlock = z.infer<typeof ImageBlockSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Union of all block types
// ─────────────────────────────────────────────────────────────────────────────

export const CanvasComponentSchema: z.ZodType = z.discriminatedUnion("type", [
    DataTableBlockSchema,
    BarChartBlockSchema,
    LineChartBlockSchema,
    PieChartBlockSchema,
    AreaChartBlockSchema,
    KPICardBlockSchema,
    TextBlockSchema,
    FilterBarBlockSchema,
    DetailViewBlockSchema,
    PropertyListBlockSchema,
    TimelineBlockSchema,
    KanbanBlockSchema,
    ListBlockSchema,
    FormBlockSchema,
    ActionButtonBlockSchema,
    SearchBlockSchema,
    TabsBlockSchema,
    AccordionBlockSchema,
    SparklineBlockSchema,
    FunnelBlockSchema,
    ProgressBarBlockSchema,
    MetricRowBlockSchema,
    StatCardBlockSchema,
    DividerBlockSchema,
    ImageBlockSchema
]);

export type CanvasComponent = z.infer<typeof CanvasComponentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Root Canvas Schema
// ─────────────────────────────────────────────────────────────────────────────

export const CanvasLayoutSchema = z.object({
    type: z.enum(["grid", "stack"]).default("grid"),
    columns: z.number().min(1).max(12).default(12),
    gap: z.number().optional().default(4).describe("Gap between blocks in tailwind spacing units"),
    padding: z.number().optional().default(4),
    maxWidth: z.string().optional().default("1400px")
});

export type CanvasLayout = z.infer<typeof CanvasLayoutSchema>;

export const CanvasThemeSchema = z
    .object({
        primaryColor: z.string().optional().describe("Primary accent color (any valid CSS color)"),
        backgroundColor: z.string().optional().describe("Canvas background color override"),
        cardBackground: z.string().optional().describe("Card/block background color"),
        cardBorder: z.string().optional().describe("Card/block border color"),
        textColor: z.string().optional().describe("Primary text color"),
        mutedTextColor: z.string().optional().describe("Secondary/muted text color"),
        chartColors: z
            .array(z.string())
            .optional()
            .describe("Custom color palette for charts (array of CSS colors)"),
        borderRadius: z
            .enum(["none", "sm", "md", "lg", "xl"])
            .optional()
            .default("md")
            .describe("Border radius for cards and blocks"),
        density: z
            .enum(["compact", "default", "spacious"])
            .optional()
            .default("default")
            .describe("Spacing density — compact reduces padding, spacious increases it")
    })
    .optional();

export type CanvasTheme = z.infer<typeof CanvasThemeSchema>;

export const CanvasSchemaSpec = z.object({
    title: z.string().describe("Canvas title"),
    description: z.string().optional(),
    layout: CanvasLayoutSchema.optional().default({}),
    dataQueries: z
        .array(DataQuerySchema)
        .default([])
        .describe("Data queries to execute server-side"),
    components: z.array(CanvasComponentSchema).describe("UI components to render"),
    theme: CanvasThemeSchema
});

export type CanvasSchemaSpec = z.infer<typeof CanvasSchemaSpec>;

// ─────────────────────────────────────────────────────────────────────────────
// Block type registry (for canvas-list-blocks tool)
// ─────────────────────────────────────────────────────────────────────────────

export interface BlockTypeInfo {
    type: string;
    name: string;
    description: string;
    category: "data" | "chart" | "kpi" | "text" | "filter" | "interactive" | "layout";
}

export const BLOCK_TYPES: BlockTypeInfo[] = [
    // Phase 1 core
    {
        type: "data-table",
        name: "Data Table",
        description:
            "Sortable, filterable table for displaying tabular data. Supports pagination, column formatting, and row actions.",
        category: "data"
    },
    {
        type: "bar-chart",
        name: "Bar Chart",
        description:
            "Vertical or horizontal bar chart for comparing values across categories. Supports stacking and multiple series.",
        category: "chart"
    },
    {
        type: "line-chart",
        name: "Line Chart",
        description:
            "Line chart for showing trends over time. Supports multiple series, curves, and data points.",
        category: "chart"
    },
    {
        type: "pie-chart",
        name: "Pie Chart",
        description:
            "Pie or donut chart for showing proportions and distribution. Supports labels and legends.",
        category: "chart"
    },
    {
        type: "area-chart",
        name: "Area Chart",
        description:
            "Area chart for visualizing cumulative values over time. Supports stacking and gradients.",
        category: "chart"
    },
    {
        type: "kpi-card",
        name: "KPI Card",
        description:
            "Single metric display card with value, optional trend indicator, and formatting. Great for dashboards.",
        category: "kpi"
    },
    {
        type: "text",
        name: "Text Block",
        description:
            "Rich text or markdown content block. Supports different variants for info, warning, etc.",
        category: "text"
    },
    {
        type: "filter-bar",
        name: "Filter Bar",
        description:
            "Row of filter controls (text, select, date) that update query parameters in real-time.",
        category: "filter"
    },
    // Phase 3 additions
    {
        type: "detail-view",
        name: "Detail View",
        description: "Single-record detail display with labeled fields in a grid layout.",
        category: "data"
    },
    {
        type: "property-list",
        name: "Property List",
        description: "Key-value pair display, horizontal or vertical orientation.",
        category: "data"
    },
    {
        type: "timeline",
        name: "Timeline",
        description: "Chronological event timeline with dates, titles, and descriptions.",
        category: "data"
    },
    {
        type: "kanban",
        name: "Kanban Board",
        description: "Kanban-style board with draggable cards organized in columns by status.",
        category: "data"
    },
    {
        type: "list",
        name: "List",
        description: "Simple list with titles, descriptions, images, and badges.",
        category: "data"
    },
    {
        type: "form",
        name: "Form",
        description: "Dynamic form with multiple field types that submits data via tool actions.",
        category: "interactive"
    },
    {
        type: "action-button",
        name: "Action Button",
        description: "Button that triggers a tool call, navigation, or link.",
        category: "interactive"
    },
    {
        type: "search",
        name: "Search",
        description: "Search input that updates a query parameter with debounce.",
        category: "interactive"
    },
    {
        type: "tabs",
        name: "Tabs",
        description: "Tabbed container for organizing blocks into switchable views.",
        category: "layout"
    },
    {
        type: "accordion",
        name: "Accordion",
        description: "Collapsible sections for organizing content hierarchically.",
        category: "layout"
    },
    {
        type: "sparkline",
        name: "Sparkline",
        description: "Inline mini-chart for embedding small trends inside KPI cards or lists.",
        category: "chart"
    },
    {
        type: "funnel",
        name: "Funnel",
        description: "Funnel chart for visualizing conversion or pipeline stages.",
        category: "chart"
    },
    {
        type: "progress-bar",
        name: "Progress Bar",
        description:
            "Horizontal progress/completion bar with label and percentage. Great for showing completion status.",
        category: "kpi"
    },
    {
        type: "metric-row",
        name: "Metric Row",
        description:
            "Horizontal row of small metrics. Perfect for summary strips at the top of a dashboard.",
        category: "kpi"
    },
    {
        type: "stat-card",
        name: "Stat Card",
        description:
            "Enhanced KPI card with icon support and optional inline sparkline. Use for prominent metrics.",
        category: "kpi"
    },
    {
        type: "divider",
        name: "Divider",
        description: "Visual separator with optional centered label for organizing sections.",
        category: "layout"
    },
    {
        type: "image",
        name: "Image",
        description: "Display an image from a URL. Supports cover, contain, and fill modes.",
        category: "data"
    }
];
