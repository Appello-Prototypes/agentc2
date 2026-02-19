"use client";

import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
    PieChart,
    Pie,
    Cell
} from "recharts";

// ─── Shared tooltip style ───────────────────────────────────────────────────

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: 12
};

// ─── Revenue & Cost Trend (Area) ────────────────────────────────────────────

export interface MonthlyFinancial {
    month: string;
    revenue: number;
    cost: number;
    margin: number;
}

export function RevenueTrendChart({ data }: { data: MonthlyFinancial[] }) {
    if (data.length === 0) {
        return (
            <div className="text-muted-foreground flex h-[300px] items-center justify-center text-sm">
                No revenue data yet
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => `$${v}`}
                />
                {/* eslint-disable @typescript-eslint/no-explicit-any */}
                <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={
                        ((value: any, name: any) => [
                            `$${Number(value).toFixed(2)}`,
                            name === "revenue"
                                ? "Revenue"
                                : name === "cost"
                                  ? "Platform Cost"
                                  : "Margin"
                        ]) as any
                    }
                />
                {/* eslint-enable @typescript-eslint/no-explicit-any */}
                <Legend
                    formatter={(value: string) =>
                        value === "revenue"
                            ? "Revenue"
                            : value === "cost"
                              ? "Platform Cost"
                              : "Gross Margin"
                    }
                />
                <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(142, 76%, 36%)"
                    fill="url(#gradRevenue)"
                    strokeWidth={2}
                />
                <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    fill="url(#gradCost)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

// ─── Margin Trend (Bar) ─────────────────────────────────────────────────────

export function MarginTrendChart({ data }: { data: MonthlyFinancial[] }) {
    if (data.length === 0) return null;

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number | undefined) => [
                        `$${Number(value ?? 0).toFixed(2)}`,
                        "Gross Margin",
                    ]}
                />
                <Bar dataKey="margin" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

// ─── Revenue by Plan (Pie) ──────────────────────────────────────────────────

export interface PlanRevenue {
    name: string;
    revenue: number;
}

const PLAN_COLORS = [
    "hsl(var(--primary))",
    "hsl(142, 76%, 36%)",
    "hsl(38, 92%, 50%)",
    "hsl(262, 83%, 58%)",
    "hsl(0, 84%, 60%)",
    "hsl(199, 89%, 48%)"
];

export function RevenueByPlanChart({ data }: { data: PlanRevenue[] }) {
    if (data.length === 0) {
        return (
            <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
                No plan data
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie
                    data={data}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={({ name, percent }: any) =>
                        `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                >
                    {data.map((_, i) => (
                        <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number | undefined) => [
                        `$${Number(value ?? 0).toFixed(2)}`,
                        "Revenue",
                    ]}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}

// ─── Cost by Provider/Model (Horizontal Bar) ───────────────────────────────

export interface ModelCost {
    label: string;
    cost: number;
}

export function CostByModelChart({ data }: { data: ModelCost[] }) {
    if (data.length === 0) {
        return (
            <div className="text-muted-foreground flex h-[280px] items-center justify-center text-sm">
                No model cost data
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 40)}>
            <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v: number) => `$${v}`}
                />
                <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    width={140}
                />
                <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number | undefined) => [
                        `$${Number(value ?? 0).toFixed(4)}`,
                        "Cost",
                    ]}
                />
                <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
