# Phase 9: Create Demo UI Pages

## Objective

Create dedicated demo pages in the agent app to showcase all Mastra primitives with interactive, stakeholder-ready demonstrations.

## Documentation References

| Feature             | Source        | URL                                                  |
| ------------------- | ------------- | ---------------------------------------------------- |
| Next.js App Router  | Next.js Docs  | https://nextjs.org/docs/app                          |
| AI SDK React Hooks  | Vercel AI SDK | https://ai-sdk.dev/docs/ai-sdk-ui/overview           |
| useChat Hook        | Vercel AI SDK | https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat |
| Mastra Studio       | Mastra Docs   | https://mastra.ai/docs/getting-started/studio        |
| Streaming Responses | Mastra Docs   | https://mastra.ai/reference/streaming/agents/stream  |

## Demo Architecture

Each demo is designed as a **standalone, interactive page** that:

1. Works independently without completing prior phases
2. Clearly shows what capability this phase adds
3. Allows users to trigger features (not just view output)
4. Shows both input and output/result
5. Can be presented to stakeholders without code explanation

## Implementation Steps

### Step 1: Create Demos Layout

Create `apps/agent/src/app/demos/layout.tsx`:

```tsx
import Link from "next/link";

export default function DemosLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-background min-h-screen">
            <nav className="bg-card border-b">
                <div className="container mx-auto flex items-center justify-between px-4 py-3">
                    <Link href="/demos" className="text-xl font-bold">
                        Mastra Primitives
                    </Link>
                    <div className="flex gap-4">
                        <Link href="/demos/agents" className="hover:text-primary">
                            Agents
                        </Link>
                        <Link href="/demos/workflows" className="hover:text-primary">
                            Workflows
                        </Link>
                        <Link href="/demos/memory" className="hover:text-primary">
                            Memory
                        </Link>
                        <Link href="/demos/rag" className="hover:text-primary">
                            RAG
                        </Link>
                        <Link href="/demos/evals" className="hover:text-primary">
                            Evals
                        </Link>
                        <Link href="/demos/mcp" className="hover:text-primary">
                            MCP
                        </Link>
                    </div>
                </div>
            </nav>
            <main className="container mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
    );
}
```

### Step 2: Create Demos Landing Page

Create `apps/agent/src/app/demos/page.tsx`:

```tsx
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

const demos = [
    {
        title: "Agents",
        description: "Explore structured output, vision analysis, and multi-step research agents",
        href: "/demos/agents",
        features: ["Structured Output", "Image Analysis", "Multi-step Reasoning"],
        status: "ready" // ready | partial | pending
    },
    {
        title: "Workflows",
        description: "See parallel processing, conditional branching, loops, and human-in-the-loop",
        href: "/demos/workflows",
        features: ["Parallel", "Branch", "Foreach", "Suspend/Resume"],
        status: "ready"
    },
    {
        title: "Memory",
        description: "Test message history, working memory, and semantic recall",
        href: "/demos/memory",
        features: ["Message History", "Working Memory", "Semantic Recall"],
        status: "partial" // Requires Phase 1
    },
    {
        title: "RAG",
        description: "Ingest documents, search vectors, and generate context-aware responses",
        href: "/demos/rag",
        features: ["Document Ingestion", "Vector Search", "Context Generation"],
        status: "partial" // Requires Phase 1
    },
    {
        title: "Evaluations",
        description: "Score agent responses for relevancy, toxicity, and helpfulness",
        href: "/demos/evals",
        features: ["Relevancy", "Toxicity", "Custom Scorers"],
        status: "ready"
    },
    {
        title: "MCP",
        description: "Use external tools via Model Context Protocol servers",
        href: "/demos/mcp",
        features: ["Wikipedia", "Sequential Thinking", "External APIs"],
        status: "ready"
    }
];

export default function DemosPage() {
    return (
        <div>
            <div className="mb-12 text-center">
                <h1 className="mb-4 text-4xl font-bold">Mastra Primitives Demo</h1>
                <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
                    Explore all the capabilities of the Mastra AI framework through interactive
                    demonstrations of each primitive.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {demos.map((demo) => (
                    <Link key={demo.href} href={demo.href}>
                        <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>{demo.title}</CardTitle>
                                    <span
                                        className={`rounded px-2 py-1 text-xs ${
                                            demo.status === "ready"
                                                ? "bg-green-100 text-green-800"
                                                : demo.status === "partial"
                                                  ? "bg-yellow-100 text-yellow-800"
                                                  : "bg-gray-100 text-gray-800"
                                        }`}
                                    >
                                        {demo.status}
                                    </span>
                                </div>
                                <CardDescription>{demo.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {demo.features.map((feature) => (
                                        <span
                                            key={feature}
                                            className="bg-primary/10 text-primary rounded px-2 py-1 text-xs"
                                        >
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
```

### Step 3: Create Agents Demo Page

Create `apps/agent/src/app/demos/agents/page.tsx`:

See Phase 3 for full implementation. Key elements:

- Agent type selector tabs (Structured, Vision, Research)
- Dynamic input forms per agent type
- JSON result viewer for structured output
- Image upload/URL for vision
- Step progress for research agent

### Step 4: Create Workflows Demo Page

Create `apps/agent/src/app/demos/workflows/page.tsx`:

See Phase 5 for full implementation. Key elements:

- Workflow type selector tabs
- Dynamic input forms per workflow
- Step-by-step execution visualization
- Suspend/Resume UI for human approval
- Result JSON viewer

### Step 5: Create Memory Demo Page

Create `apps/agent/src/app/demos/memory/page.tsx`:

See Phase 1 for full implementation. Key elements:

- Chat interface with thread persistence
- Working memory display panel
- Semantic recall search interface
- Message history visualization

### Step 6: Create RAG Demo Page

Create `apps/agent/src/app/demos/rag/page.tsx`:

See Phase 6 for full implementation. Key elements:

- Document ingest form (content, type, source name)
- Query interface with search/generate toggle
- Results with similarity scores
- Source citations display

### Step 7: Create Evals Demo Page

Create `apps/agent/src/app/demos/evals/page.tsx`:

See Phase 7 for full implementation. Key elements:

- Input/Output text areas
- Generate & Evaluate button
- Score cards with percentages
- Reasoning display per scorer

### Step 8: Create MCP Demo Page

Create `apps/agent/src/app/demos/mcp/page.tsx`:

See Phase 8 for full implementation. Key elements:

- Query input
- Server connection status
- Response with tool calls
- Expandable tool execution details

### Step 9: Create API Routes for Demos

Create the following API routes to support demo pages:

| Route                          | File       | Purpose                    |
| ------------------------------ | ---------- | -------------------------- |
| `/api/demos/agents/structured` | `route.ts` | Structured output agent    |
| `/api/demos/agents/vision`     | `route.ts` | Vision agent               |
| `/api/demos/agents/research`   | `route.ts` | Research agent             |
| `/api/demos/workflows`         | `route.ts` | Run workflows              |
| `/api/demos/workflows/resume`  | `route.ts` | Resume suspended workflows |
| `/api/demos/memory/working`    | `route.ts` | Get working memory         |
| `/api/demos/memory/semantic`   | `route.ts` | Semantic recall search     |
| `/api/demos/evals`             | `route.ts` | Run evaluations            |
| `/api/demos/evals/generate`    | `route.ts` | Generate and evaluate      |

### Step 10: Update Navigation

Update navigation config to include demos link in sidebar/header.

## Demo Page Requirements Matrix

| Demo      | Isolation         | Progression          | Interactivity          | Visibility             | Stakeholder-Ready |
| --------- | ----------------- | -------------------- | ---------------------- | ---------------------- | ----------------- |
| Agents    | Full              | Shows 3 agent types  | User types queries     | Input → Output         | Yes               |
| Workflows | Full              | Shows 4 patterns     | User triggers runs     | Steps → Result         | Yes               |
| Memory    | Partial (Phase 1) | Shows 3 memory types | User chats & searches  | Chat → Recall          | Yes               |
| RAG       | Partial (Phase 1) | Shows pipeline       | User ingests & queries | Docs → Answers         | Yes               |
| Evals     | Full              | Shows scorers        | User evaluates text    | Input → Scores         | Yes               |
| MCP       | Full              | Shows external tools | User queries           | Query → Tools → Answer | Yes               |

## Documentation Deviations

| Deviation                     | Status               | Justification                                   |
| ----------------------------- | -------------------- | ----------------------------------------------- |
| Using shadcn/ui components    | **Project standard** | Per CLAUDE.md, use @repo/ui components          |
| Status badges on landing page | **Enhancement**      | Helps stakeholders understand completion status |
| Minimal styling               | **Valid**            | Can be enhanced with project's design system    |

## Demo Page Spec (Summary)

### Each Demo Must Include:

1. **Header**: Title, description, status badge
2. **Input Section**: Forms, selectors, text areas
3. **Action Buttons**: Submit, generate, run, etc.
4. **Output Section**: Results, scores, visualizations
5. **Loading States**: Spinners, skeletons, progress bars
6. **Error States**: Error messages, retry buttons
7. **Sample Data**: Pre-filled examples or "Try Example" buttons

### Responsive Requirements:

- Desktop: 2-3 column layouts where appropriate
- Tablet: Stacked sections
- Mobile: Single column, touch-friendly inputs

## Dependency Map

- **Requires**: All prior phases for full functionality
- **Enables**: Stakeholder presentations, manual testing
- **Standalone**: Landing page and basic UI work without backend

## Acceptance Criteria

- [ ] Landing page displays all 6 demo categories
- [ ] Each demo page loads without errors
- [ ] Agents demo: all 3 agent types interactive
- [ ] Workflows demo: all 4 workflow types runnable
- [ ] Memory demo: chat, working memory, and semantic recall work
- [ ] RAG demo: ingest and query functional
- [ ] Evals demo: scoring works with all scorers
- [ ] MCP demo: external tools callable
- [ ] All demos handle loading states
- [ ] All demos handle error states
- [ ] Responsive on mobile/tablet/desktop
- [ ] Navigation between demos works

## Test Plan

### Frontend

- [ ] All demo pages render without console errors
- [ ] Tab/selector navigation works on each page
- [ ] Form validation prevents invalid submissions
- [ ] Loading states display during API calls
- [ ] Error messages display and are dismissible
- [ ] Results render correctly (JSON, text, scores)
- [ ] Mobile breakpoints work correctly
- [ ] Keyboard navigation accessible

### Backend

- [ ] All API routes return correct response shapes
- [ ] Authentication required on all routes
- [ ] Invalid inputs return 400 with message
- [ ] Server errors return 500 with details
- [ ] Rate limiting prevents abuse (optional)

### Integration

- [ ] End-to-end flow works on each demo
- [ ] Demo to demo navigation preserves context
- [ ] Refresh maintains current demo state
- [ ] Deep links to specific demos work
- [ ] Demo results correlate with backend traces

## Files Changed

| File                                                      | Action |
| --------------------------------------------------------- | ------ |
| `apps/agent/src/app/demos/layout.tsx`                     | Create |
| `apps/agent/src/app/demos/page.tsx`                       | Create |
| `apps/agent/src/app/demos/agents/page.tsx`                | Create |
| `apps/agent/src/app/demos/workflows/page.tsx`             | Create |
| `apps/agent/src/app/demos/memory/page.tsx`                | Create |
| `apps/agent/src/app/demos/rag/page.tsx`                   | Create |
| `apps/agent/src/app/demos/evals/page.tsx`                 | Create |
| `apps/agent/src/app/demos/mcp/page.tsx`                   | Create |
| `apps/agent/src/app/api/demos/agents/structured/route.ts` | Create |
| `apps/agent/src/app/api/demos/agents/vision/route.ts`     | Create |
| `apps/agent/src/app/api/demos/agents/research/route.ts`   | Create |
| `apps/agent/src/app/api/demos/workflows/route.ts`         | Create |
| `apps/agent/src/app/api/demos/workflows/resume/route.ts`  | Create |
| `apps/agent/src/app/api/demos/memory/working/route.ts`    | Create |
| `apps/agent/src/app/api/demos/memory/semantic/route.ts`   | Create |
| `apps/agent/src/app/api/demos/evals/route.ts`             | Create |
| `apps/agent/src/app/api/demos/evals/generate/route.ts`    | Create |
| Navigation config updates                                 | Update |
