"use client";

import { useState } from "react";

export interface TrendSeries {
    key: string;
    label: string;
    data: Array<{ date: string; score: number }>;
    color: string;
    visible: boolean;
}

export interface TrendAnnotation {
    date: string;
    type: string;
    label: string;
    linkUrl?: string;
}

interface MultiLineTrendChartProps {
    series: TrendSeries[];
    annotations?: TrendAnnotation[];
    height?: number;
    onAnnotationClick?: (annotation: TrendAnnotation) => void;
}

/** Color palette for known scorers */
export const SCORER_COLORS: Record<string, string> = {
    relevancy: "#3b82f6",
    completeness: "#22c55e",
    tone: "#a855f7",
    toxicity: "#ef4444",
    helpfulness: "#f59e0b",
    conciseness: "#06b6d4",
    accuracy: "#ec4899",
    coherence: "#8b5cf6"
};

const FALLBACK_COLORS = ["#14b8a6", "#f97316", "#6366f1", "#84cc16", "#e11d48", "#0ea5e9"];

export function getScorerColor(scorer: string, index: number): string {
    return SCORER_COLORS[scorer] || FALLBACK_COLORS[index % FALLBACK_COLORS.length] || "#888";
}

export function MultiLineTrendChart({
    series,
    annotations = [],
    height = 250,
    onAnnotationClick
}: MultiLineTrendChartProps) {
    const [hoveredPoint, setHoveredPoint] = useState<{
        seriesKey: string;
        index: number;
        x: number;
        y: number;
    } | null>(null);
    const [hoveredAnnotation, setHoveredAnnotation] = useState<number | null>(null);

    const visibleSeries = series.filter((s) => s.visible && s.data.length > 0);

    if (visibleSeries.length === 0) {
        return (
            <div
                className="text-muted-foreground flex items-center justify-center"
                style={{ height }}
            >
                No trend data available
            </div>
        );
    }

    // Collect all unique dates across all visible series and sort them
    const allDatesSet = new Set<string>();
    for (const s of visibleSeries) {
        for (const d of s.data) {
            allDatesSet.add(d.date);
        }
    }
    const allDates = Array.from(allDatesSet).sort();

    if (allDates.length === 0) {
        return (
            <div
                className="text-muted-foreground flex items-center justify-center"
                style={{ height }}
            >
                No trend data available
            </div>
        );
    }

    // Chart dimensions (adapted from CostPerRunChart)
    const chartWidth = 800;
    const chartHeight = height;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // Y-axis: 0 to 1.0 (scores are 0-1)
    const yMin = 0;
    const yMax = 1.0;

    // X scale: map date index to x position
    const xScale = (dateIndex: number) =>
        padding.left +
        (allDates.length > 1 ? (dateIndex / (allDates.length - 1)) * innerWidth : innerWidth / 2);

    // Y scale: map score to y position
    const yScale = (score: number) =>
        padding.top + innerHeight - ((score - yMin) / (yMax - yMin)) * innerHeight;

    // Y-axis ticks (0, 0.25, 0.5, 0.75, 1.0)
    const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((value) => ({
        value,
        y: yScale(value)
    }));

    // X-axis labels (show up to 8 date labels)
    const xLabelCount = Math.min(allDates.length, 8);
    const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
        const idx =
            allDates.length <= 1 ? 0 : Math.round((i / (xLabelCount - 1)) * (allDates.length - 1));
        return {
            x: xScale(idx),
            label: formatDateLabel(allDates[idx])
        };
    });

    // Build polyline points for each visible series
    const seriesLines = visibleSeries.map((s) => {
        // Create a date-to-score map for this series
        const dateScoreMap = new Map<string, number>();
        for (const d of s.data) {
            dateScoreMap.set(d.date, d.score);
        }

        // Build points array only for dates where this series has data
        const points: Array<{ dateIndex: number; score: number; date: string }> = [];
        for (let i = 0; i < allDates.length; i++) {
            const score = dateScoreMap.get(allDates[i]);
            if (score !== undefined) {
                points.push({ dateIndex: i, score, date: allDates[i] });
            }
        }

        const linePoints = points.map((p) => `${xScale(p.dateIndex)},${yScale(p.score)}`).join(" ");

        return { series: s, points, linePoints };
    });

    // Compute annotation X positions
    const annotationPositions = annotations.map((ann) => {
        const annDate = ann.date.split("T")[0];
        // Find closest date in allDates
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < allDates.length; i++) {
            const diff = Math.abs(new Date(allDates[i]).getTime() - new Date(annDate).getTime());
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        return { annotation: ann, x: xScale(closestIdx) };
    });

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full"
                style={{ height }}
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Y-axis grid lines and labels */}
                {yTicks.map((tick, i) => (
                    <g key={i}>
                        <line
                            x1={padding.left}
                            y1={tick.y}
                            x2={chartWidth - padding.right}
                            y2={tick.y}
                            stroke="currentColor"
                            strokeOpacity={0.1}
                            strokeDasharray="4 4"
                        />
                        <text
                            x={padding.left - 8}
                            y={tick.y + 4}
                            textAnchor="end"
                            className="fill-muted-foreground"
                            fontSize={10}
                        >
                            {(tick.value * 100).toFixed(0)}%
                        </text>
                    </g>
                ))}

                {/* X-axis labels */}
                {xLabels.map((label, i) => (
                    <text
                        key={i}
                        x={label.x}
                        y={chartHeight - 5}
                        textAnchor="middle"
                        className="fill-muted-foreground"
                        fontSize={9}
                    >
                        {label.label}
                    </text>
                ))}

                {/* Annotation vertical lines */}
                {annotationPositions.map((ap, i) => (
                    <g key={`ann-${i}`}>
                        <line
                            x1={ap.x}
                            y1={padding.top}
                            x2={ap.x}
                            y2={padding.top + innerHeight}
                            stroke={ap.annotation.type === "learning" ? "#f59e0b" : "#6366f1"}
                            strokeWidth={1.5}
                            strokeDasharray="6 3"
                            strokeOpacity={0.6}
                        />
                        {/* Clickable hit area */}
                        <rect
                            x={ap.x - 20}
                            y={padding.top}
                            width={40}
                            height={innerHeight}
                            fill="transparent"
                            className={
                                onAnnotationClick && ap.annotation.linkUrl ? "cursor-pointer" : ""
                            }
                            onMouseEnter={() => setHoveredAnnotation(i)}
                            onMouseLeave={() => setHoveredAnnotation(null)}
                            onClick={() => {
                                if (onAnnotationClick && ap.annotation.linkUrl) {
                                    onAnnotationClick(ap.annotation);
                                }
                            }}
                        />
                        {/* Small annotation marker at bottom */}
                        <circle
                            cx={ap.x}
                            cy={padding.top + innerHeight + 10}
                            r={4}
                            fill={ap.annotation.type === "learning" ? "#f59e0b" : "#6366f1"}
                        />
                    </g>
                ))}

                {/* Series polylines */}
                {seriesLines.map(({ series: s, points, linePoints }) =>
                    points.length > 1 ? (
                        <polyline
                            key={s.key}
                            points={linePoints}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                    ) : null
                )}

                {/* Data points with hover */}
                {seriesLines.map(({ series: s, points }) =>
                    points.map((p, i) => (
                        <g key={`${s.key}-${i}`}>
                            {/* Invisible hit area */}
                            <circle
                                cx={xScale(p.dateIndex)}
                                cy={yScale(p.score)}
                                r={12}
                                fill="transparent"
                                onMouseEnter={() =>
                                    setHoveredPoint({
                                        seriesKey: s.key,
                                        index: i,
                                        x: xScale(p.dateIndex),
                                        y: yScale(p.score)
                                    })
                                }
                                onMouseLeave={() => setHoveredPoint(null)}
                            />
                            {/* Visible dot */}
                            <circle
                                cx={xScale(p.dateIndex)}
                                cy={yScale(p.score)}
                                r={
                                    hoveredPoint?.seriesKey === s.key && hoveredPoint?.index === i
                                        ? 5
                                        : 3
                                }
                                fill={s.color}
                                className="transition-all duration-150"
                            />
                        </g>
                    ))
                )}
            </svg>

            {/* Data point tooltip */}
            {hoveredPoint &&
                (() => {
                    const matchedLine = seriesLines.find(
                        (sl) => sl.series.key === hoveredPoint.seriesKey
                    );
                    if (!matchedLine) return null;
                    const point = matchedLine.points[hoveredPoint.index];
                    if (!point) return null;

                    // Collect all series values at this date
                    const dateStr = point.date;
                    const allValues: Array<{ label: string; score: number; color: string }> = [];
                    for (const sl of seriesLines) {
                        const match = sl.points.find((p) => p.date === dateStr);
                        if (match) {
                            allValues.push({
                                label: sl.series.label,
                                score: match.score,
                                color: sl.series.color
                            });
                        }
                    }

                    return (
                        <div
                            className="bg-popover text-popover-foreground pointer-events-none absolute z-10 rounded-lg border px-3 py-2 shadow-lg"
                            style={{
                                left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                                top: `${(hoveredPoint.y / chartHeight) * 100 - 12}%`,
                                transform: "translate(-50%, -100%)"
                            }}
                        >
                            <p className="text-muted-foreground mb-1 text-xs font-medium">
                                {formatDateLabel(dateStr)}
                            </p>
                            {allValues.map((v) => (
                                <div key={v.label} className="flex items-center gap-2 text-xs">
                                    <span
                                        className="inline-block h-2 w-2 rounded-full"
                                        style={{ backgroundColor: v.color }}
                                    />
                                    <span className="capitalize">{v.label}</span>
                                    <span className="font-mono font-semibold">
                                        {(v.score * 100).toFixed(0)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    );
                })()}

            {/* Annotation tooltip */}
            {hoveredAnnotation !== null && annotationPositions[hoveredAnnotation] && (
                <div
                    className="bg-popover text-popover-foreground pointer-events-none absolute z-10 rounded-lg border px-3 py-2 shadow-lg"
                    style={{
                        left: `${(annotationPositions[hoveredAnnotation].x / chartWidth) * 100}%`,
                        top: `${((padding.top + innerHeight + 16) / chartHeight) * 100}%`,
                        transform: "translateX(-50%)"
                    }}
                >
                    <p className="text-xs font-medium">
                        {annotationPositions[hoveredAnnotation].annotation.label}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                        {formatDateLabel(annotationPositions[hoveredAnnotation].annotation.date)}
                    </p>
                    {annotationPositions[hoveredAnnotation].annotation.linkUrl && (
                        <p className="mt-0.5 text-[10px] text-blue-500">Click to view details</p>
                    )}
                </div>
            )}
        </div>
    );
}

function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
    });
}
