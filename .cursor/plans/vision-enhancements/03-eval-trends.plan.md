---
name: "Enhancement 3: Evaluation Performance Trajectories"
overview: "Upgrade the evaluation trends display from simple bar charts to a multi-line SVG chart with time-series data, scorer toggles, and learning event annotations so users can see cause-and-effect over time."
todos:
    - id: trend-api-enhancement
      content: "Enhance evaluations API to return time-bucketed trend data with dates (not just aggregates) and learning event timestamps for annotation"
      status: pending
    - id: multi-line-chart-component
      content: "Build MultiLineTrendChart SVG component adapted from existing CostPerRunChart pattern -- multiple colored polylines, hover tooltips, vertical annotation lines"
      status: pending
    - id: trends-tab-ui
      content: "Add or enhance the Trends view on the evaluations page with time range selector, scorer checkbox toggles, and the new chart component"
      status: pending
    - id: annotation-click-navigation
      content: "Make learning event annotations clickable -- navigate to the learning session detail page when clicked"
      status: pending
isProject: false
---

# Enhancement 3: Evaluation Performance Trajectories

## Goal

Replace the basic bar-chart trend display on the evaluations page with a proper multi-line SVG chart showing how each evaluation scorer trends over time. Add annotations for learning sessions and version changes so users can see cause and effect.

## Dependencies

- None. This enhancement is self-contained.

## Pre-requisites to Understand

- The evaluations page is at [apps/agent/src/app/agents/[agentSlug]/evaluations/page.tsx](apps/agent/src/app/agents/[agentSlug]/evaluations/page.tsx)
- It already has a `TrendData` interface (line 87): `{ scorer: string; data: Array<{ date: string; score: number }> }`
- It already fetches trends from the API (line 395): `setTrends(result.trends || [])`
- The current trends rendering (line 690-732) shows simple bar charts per scorer -- each bar is one data point, no lines, no annotations
- The `CostPerRunChart` component at [apps/agent/src/app/agents/[agentSlug]/costs/page.tsx](apps/agent/src/app/agents/[agentSlug]/costs/page.tsx) (line 119-303) is a hand-built SVG chart with: `<polyline>` for the line, `<circle>` for data points, hover tooltips, dashed average line, Y-axis ticks, X-axis labels. This is the pattern to adapt.
- The learning sessions API provides session data with `createdAt` and `completedAt` timestamps that can be used as annotations

---

## Step 1: Enhance the API Response

**File:** Find the evaluations API route (likely `apps/agent/src/app/api/agents/[agentSlug]/evaluations/route.ts` or similar).

The API already returns `trends` as `TrendData[]`. Enhance it to also return:

```typescript
interface TrendAnnotation {
    date: string; // ISO timestamp
    type: "learning" | "version" | "skill";
    label: string; // e.g., "Learning session promoted" or "Version 5 deployed"
    linkUrl?: string; // e.g., "/agents/{slug}/learning/{sessionId}"
}
```

Add a `trendAnnotations` field to the API response:

- Query `LearningSession` where status = "promoted" or "completed" and createdAt is in the trend date range
- Query `AgentVersion` changes in the trend date range
- Map each to a `TrendAnnotation`

Also enhance the trend time range -- currently appears to be 14 days. Support 7/30/90 day ranges via query parameter.

---

## Step 2: Build MultiLineTrendChart Component

**File:** Create `apps/agent/src/components/charts/MultiLineTrendChart.tsx`

Adapt the `CostPerRunChart` SVG pattern from the costs page. The new component needs:

**Props:**

```typescript
interface MultiLineTrendChartProps {
    series: Array<{
        key: string;
        label: string;
        data: Array<{ date: string; score: number }>;
        color: string;
        visible: boolean;
    }>;
    annotations?: Array<{
        date: string;
        type: string;
        label: string;
        linkUrl?: string;
    }>;
    height?: number;
    onAnnotationClick?: (annotation: { linkUrl?: string }) => void;
}
```

**SVG structure (adapted from CostPerRunChart):**

1. Y-axis: 0 to 1.0 (scores are 0-1), with 5 tick marks and grid lines (same pattern as CostPerRunChart yTicks)
2. X-axis: dates, with label distribution (same pattern as CostPerRunChart xLabels)
3. For each visible series: a `<polyline>` with the series color, and `<circle>` data points with hover behavior
4. For each annotation: a vertical dashed `<line>` spanning the chart height, with a small label at the bottom
5. Hover tooltip: shows date, all visible scorer values at that date, and annotation label if present

**Color palette for scorers:**

- relevancy: blue (#3b82f6)
- completeness: green (#22c55e)
- tone: purple (#a855f7)
- toxicity: red (#ef4444)
- helpfulness: amber (#f59e0b)
- others: cycle through remaining colors

The chart dimensions, padding, scale functions, and SVG rendering all follow the exact CostPerRunChart pattern (chartWidth=800, chartHeight=250, padding object, xScale/yScale functions, polyline points string building).

---

## Step 3: Update Evaluations Page

**File:** [apps/agent/src/app/agents/[agentSlug]/evaluations/page.tsx](apps/agent/src/app/agents/[agentSlug]/evaluations/page.tsx)

**Changes:**

1. Add `trendAnnotations` to state (alongside existing `trends` state at line 344):

```typescript
const [trendAnnotations, setTrendAnnotations] = useState<TrendAnnotation[]>([]);
const [trendTimeRange, setTrendTimeRange] = useState<"7d" | "30d" | "90d">("30d");
const [visibleScorers, setVisibleScorers] = useState<Set<string>>(new Set());
```

2. Update the fetch to pass time range and capture annotations:

```typescript
setTrendAnnotations(result.trendAnnotations || []);
// Initialize visible scorers to all
if (result.trends?.length > 0 && visibleScorers.size === 0) {
    setVisibleScorers(new Set(result.trends.map((t) => t.scorer)));
}
```

3. **Replace the existing trend rendering** (lines 690-732) with the new component:

Replace the existing Card with "Score Trends" that renders bar charts per scorer. Instead:

```tsx
<Card>
    <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Score Trends</CardTitle>
                <CardDescription>Performance over time</CardDescription>
            </div>
            <Select value={trendTimeRange} onValueChange={(v) => setTrendTimeRange(v)}>
                <SelectTrigger className="w-24">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="7d">7 days</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="90d">90 days</SelectItem>
                </SelectContent>
            </Select>
        </div>
    </CardHeader>
    <CardContent>
        <MultiLineTrendChart
            series={trends.map((t) => ({
                key: t.scorer,
                label: t.scorer,
                data: t.data,
                color: SCORER_COLORS[t.scorer] || "#888",
                visible: visibleScorers.has(t.scorer)
            }))}
            annotations={trendAnnotations}
            onAnnotationClick={(ann) => {
                if (ann.linkUrl) router.push(ann.linkUrl);
            }}
        />
        {/* Scorer toggle checkboxes */}
        <div className="mt-4 flex flex-wrap gap-3">
            {trends.map((t) => (
                <label key={t.scorer} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                        type="checkbox"
                        checked={visibleScorers.has(t.scorer)}
                        onChange={() => {
                            const next = new Set(visibleScorers);
                            next.has(t.scorer) ? next.delete(t.scorer) : next.add(t.scorer);
                            setVisibleScorers(next);
                        }}
                    />
                    <span style={{ color: SCORER_COLORS[t.scorer] }}>●</span>
                    <span className="capitalize">{t.scorer}</span>
                </label>
            ))}
        </div>
    </CardContent>
</Card>
```

4. Import the new component and define SCORER_COLORS constant.

---

## Step 4: Annotation Click Navigation

The `onAnnotationClick` handler in Step 3 already uses `router.push(ann.linkUrl)`. The linkUrl is constructed in the API (Step 1) as:

- Learning sessions: `/agents/${agentSlug}/learning/${sessionId}`
- Version changes: `/agents/${agentSlug}/versions`

No additional work needed -- the router is already available via `useRouter()` (line 3 of the evaluations page).

---

## Testing

1. Navigate to `/agents/{slug}/evaluations` -- verify trends chart renders
2. Toggle individual scorers on/off -- verify lines appear/disappear
3. Change time range (7d/30d/90d) -- verify chart re-fetches and re-renders
4. Hover over data points -- verify tooltip shows date + scores
5. If learning sessions exist, verify vertical annotation lines appear at correct dates
6. Click an annotation -- verify navigation to learning session detail
7. If no trend data, verify "No trend data available" empty state
8. Run `bun run type-check`, `bun run lint`, `bun run build`
