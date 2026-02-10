import { prisma } from "../packages/database/src";

const templates = [
    {
        slug: "template-hubspot-deal-pipeline",
        title: "HubSpot Deal Pipeline",
        description:
            "Overview of your HubSpot deal pipeline with KPIs, stage chart, and deal table.",
        category: "template",
        tags: ["hubspot", "crm", "deals", "pipeline"],
        schemaJson: {
            title: "Deal Pipeline Dashboard",
            description: "Real-time overview of your HubSpot deal pipeline",
            layout: { type: "grid", columns: 12, gap: 4 },
            dataQueries: [
                {
                    id: "deals",
                    source: "mcp",
                    tool: "hubspot_hubspot-search-objects",
                    params: {
                        objectType: "deals",
                        limit: 100,
                        properties: [
                            "dealname",
                            "amount",
                            "dealstage",
                            "closedate",
                            "pipeline",
                            "hubspot_owner_id"
                        ]
                    }
                }
            ],
            components: [
                {
                    id: "kpi-total",
                    type: "kpi-card",
                    span: 3,
                    title: "Total Pipeline",
                    value: "{{ sum(queries.deals, 'amount') }}",
                    format: "currency",
                    color: "blue"
                },
                {
                    id: "kpi-count",
                    type: "kpi-card",
                    span: 3,
                    title: "Open Deals",
                    value: "{{ count(queries.deals) }}",
                    format: "number",
                    color: "green"
                },
                {
                    id: "kpi-avg",
                    type: "kpi-card",
                    span: 3,
                    title: "Avg Deal Size",
                    value: "{{ avg(queries.deals, 'amount') }}",
                    format: "currency",
                    color: "purple"
                },
                {
                    id: "kpi-max",
                    type: "kpi-card",
                    span: 3,
                    title: "Largest Deal",
                    value: "{{ max(queries.deals, 'amount') }}",
                    format: "currency",
                    color: "yellow"
                },
                {
                    id: "stage-chart",
                    type: "bar-chart",
                    span: 8,
                    title: "Deals by Stage",
                    data: "{{ groupBy(queries.deals, 'dealstage') }}",
                    xAxis: "name",
                    yAxis: "count",
                    height: 300
                },
                {
                    id: "stage-pie",
                    type: "pie-chart",
                    span: 4,
                    title: "Stage Distribution",
                    data: "{{ groupBy(queries.deals, 'dealstage') }}",
                    nameKey: "name",
                    valueKey: "count",
                    donut: true,
                    height: 300
                },
                {
                    id: "deals-table",
                    type: "data-table",
                    span: 12,
                    title: "All Deals",
                    data: "{{ queries.deals }}",
                    searchable: true,
                    pageSize: 15,
                    columns: [
                        { key: "dealname", label: "Deal Name", sortable: true },
                        {
                            key: "amount",
                            label: "Amount",
                            format: "currency",
                            sortable: true,
                            align: "right"
                        },
                        { key: "dealstage", label: "Stage", format: "badge" },
                        { key: "closedate", label: "Close Date", format: "date", sortable: true }
                    ]
                }
            ]
        }
    },
    {
        slug: "template-jira-sprint-board",
        title: "Jira Sprint Board",
        description: "Sprint overview with kanban board, issue stats, and priority breakdown.",
        category: "template",
        tags: ["jira", "sprint", "agile", "project-management"],
        schemaJson: {
            title: "Sprint Dashboard",
            description: "Current sprint overview from Jira",
            layout: { type: "grid", columns: 12, gap: 4 },
            dataQueries: [
                {
                    id: "issues",
                    source: "mcp",
                    tool: "jira_jira_search",
                    params: {
                        jql: "sprint in openSprints() ORDER BY priority DESC",
                        fields: "summary,status,priority,assignee,issuetype",
                        limit: 50
                    }
                }
            ],
            components: [
                {
                    id: "kpi-total",
                    type: "kpi-card",
                    span: 3,
                    title: "Total Issues",
                    value: "{{ count(queries.issues) }}",
                    color: "blue"
                },
                {
                    id: "kpi-done",
                    type: "kpi-card",
                    span: 3,
                    title: "Completed",
                    value: "{{ count(filter(queries.issues, 'status', 'Done')) }}",
                    color: "green"
                },
                {
                    id: "kpi-progress",
                    type: "kpi-card",
                    span: 3,
                    title: "In Progress",
                    value: "{{ count(filter(queries.issues, 'status', 'In Progress')) }}",
                    color: "yellow"
                },
                {
                    id: "kpi-todo",
                    type: "kpi-card",
                    span: 3,
                    title: "To Do",
                    value: "{{ count(filter(queries.issues, 'status', 'To Do')) }}",
                    color: "default"
                },
                {
                    id: "priority-chart",
                    type: "bar-chart",
                    span: 6,
                    title: "Issues by Priority",
                    data: "{{ groupBy(queries.issues, 'priority') }}",
                    xAxis: "name",
                    yAxis: "count",
                    height: 250
                },
                {
                    id: "type-pie",
                    type: "pie-chart",
                    span: 6,
                    title: "Issue Types",
                    data: "{{ groupBy(queries.issues, 'issuetype') }}",
                    nameKey: "name",
                    valueKey: "count",
                    donut: true,
                    height: 250
                },
                {
                    id: "issues-table",
                    type: "data-table",
                    span: 12,
                    title: "Sprint Issues",
                    data: "{{ queries.issues }}",
                    searchable: true,
                    pageSize: 20,
                    columns: [
                        { key: "summary", label: "Summary", sortable: true },
                        { key: "status", label: "Status", format: "badge" },
                        { key: "priority", label: "Priority", format: "badge", sortable: true },
                        { key: "assignee", label: "Assignee" },
                        { key: "issuetype", label: "Type" }
                    ]
                }
            ]
        }
    },
    {
        slug: "template-meeting-summary",
        title: "Meeting Summary",
        description: "Recent meeting summaries with action items and participant list.",
        category: "template",
        tags: ["meetings", "fathom", "action-items"],
        schemaJson: {
            title: "Meeting Summary Dashboard",
            description: "Recent meetings and action items",
            layout: { type: "grid", columns: 12, gap: 4 },
            dataQueries: [
                {
                    id: "meetings",
                    source: "static",
                    data: [
                        {
                            title: "Sprint Planning",
                            date: "2026-02-10T10:00:00Z",
                            participants: "Team A",
                            summary: "Planned sprint 12 with 24 story points",
                            actionItems: 5
                        },
                        {
                            title: "Client Review",
                            date: "2026-02-09T14:00:00Z",
                            participants: "Client + PM",
                            summary: "Reviewed Q1 deliverables, all on track",
                            actionItems: 3
                        },
                        {
                            title: "Design Review",
                            date: "2026-02-08T11:00:00Z",
                            participants: "Design Team",
                            summary: "Finalized dashboard redesign mockups",
                            actionItems: 2
                        }
                    ]
                }
            ],
            components: [
                {
                    id: "kpi-meetings",
                    type: "kpi-card",
                    span: 4,
                    title: "Meetings This Week",
                    value: "{{ count(queries.meetings) }}",
                    color: "blue"
                },
                {
                    id: "kpi-actions",
                    type: "kpi-card",
                    span: 4,
                    title: "Action Items",
                    value: "{{ sum(queries.meetings, 'actionItems') }}",
                    color: "yellow"
                },
                {
                    id: "kpi-participants",
                    type: "kpi-card",
                    span: 4,
                    title: "Unique Groups",
                    value: "{{ count(unique(queries.meetings, 'participants')) }}",
                    color: "green"
                },
                {
                    id: "timeline",
                    type: "timeline",
                    span: 6,
                    title: "Recent Meetings",
                    data: "{{ queries.meetings }}",
                    dateKey: "date",
                    titleKey: "title",
                    descriptionKey: "summary"
                },
                {
                    id: "meetings-table",
                    type: "data-table",
                    span: 6,
                    title: "Meeting Details",
                    data: "{{ queries.meetings }}",
                    columns: [
                        { key: "title", label: "Meeting", sortable: true },
                        { key: "date", label: "Date", format: "date", sortable: true },
                        { key: "participants", label: "Participants" },
                        { key: "actionItems", label: "Actions", align: "right" }
                    ]
                }
            ]
        }
    },
    {
        slug: "template-email-analytics",
        title: "Email Analytics",
        description: "Email volume, response metrics, and thread overview.",
        category: "template",
        tags: ["email", "gmail", "analytics"],
        schemaJson: {
            title: "Email Analytics",
            description: "Overview of email activity and response patterns",
            layout: { type: "grid", columns: 12, gap: 4 },
            dataQueries: [
                {
                    id: "emailStats",
                    source: "static",
                    data: [
                        { day: "Mon", sent: 12, received: 28 },
                        { day: "Tue", sent: 15, received: 32 },
                        { day: "Wed", sent: 8, received: 22 },
                        { day: "Thu", sent: 18, received: 35 },
                        { day: "Fri", sent: 10, received: 18 }
                    ]
                }
            ],
            components: [
                {
                    id: "kpi-sent",
                    type: "kpi-card",
                    span: 3,
                    title: "Emails Sent",
                    value: "{{ sum(queries.emailStats, 'sent') }}",
                    color: "blue"
                },
                {
                    id: "kpi-received",
                    type: "kpi-card",
                    span: 3,
                    title: "Emails Received",
                    value: "{{ sum(queries.emailStats, 'received') }}",
                    color: "green"
                },
                {
                    id: "kpi-ratio",
                    type: "kpi-card",
                    span: 3,
                    title: "Send/Receive Ratio",
                    value: "{{ formatPercent(avg(queries.emailStats, 'sent') / avg(queries.emailStats, 'received')) }}",
                    color: "purple"
                },
                {
                    id: "kpi-busiest",
                    type: "kpi-card",
                    span: 3,
                    title: "Peak Day Emails",
                    value: "{{ max(queries.emailStats, 'received') }}",
                    color: "yellow"
                },
                {
                    id: "volume-chart",
                    type: "area-chart",
                    span: 12,
                    title: "Email Volume by Day",
                    data: "{{ queries.emailStats }}",
                    xAxis: "day",
                    yAxis: ["sent", "received"],
                    stacked: false,
                    height: 300
                }
            ]
        }
    }
];

async function seedCanvasTemplates() {
    console.log("Seeding canvas templates...");

    for (const template of templates) {
        const existing = await prisma.canvas.findUnique({ where: { slug: template.slug } });

        if (existing) {
            console.log(`  Updating: ${template.slug}`);
            await prisma.canvas.update({
                where: { slug: template.slug },
                data: {
                    title: template.title,
                    description: template.description,
                    schemaJson: template.schemaJson,
                    tags: template.tags,
                    category: template.category
                }
            });
        } else {
            console.log(`  Creating: ${template.slug}`);
            const canvas = await prisma.canvas.create({
                data: {
                    slug: template.slug,
                    title: template.title,
                    description: template.description,
                    schemaJson: template.schemaJson,
                    tags: template.tags,
                    category: template.category,
                    isPublished: true
                }
            });

            await prisma.canvasVersion.create({
                data: {
                    canvasId: canvas.id,
                    version: 1,
                    schemaJson: template.schemaJson,
                    changelog: "Initial template"
                }
            });
        }
    }

    console.log(`Seeded ${templates.length} canvas templates!`);
}

seedCanvasTemplates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
