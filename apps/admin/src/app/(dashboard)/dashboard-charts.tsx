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
    Cell
} from "recharts";

const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: 12
};

export interface MonthlyRevenue {
    month: string;
    revenue: number;
    cost: number;
}

export function RevenueSparkChart({ data }: { data: MonthlyRevenue[] }) {
    if (data.length === 0) {
        return (
            <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
                No revenue data yet
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="gradDashRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDashCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
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
                            name === "revenue" ? "Revenue" : "Platform Cost"
                        ]) as any
                    }
                />
                {/* eslint-enable @typescript-eslint/no-explicit-any */}
                <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(142, 76%, 36%)"
                    fill="url(#gradDashRev)"
                    strokeWidth={2}
                />
                <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="hsl(var(--primary))"
                    fill="url(#gradDashCost)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}

export interface TenantStatusData {
    status: string;
    count: number;
}

const STATUS_COLORS: Record<string, string> = {
    active: "hsl(142, 76%, 36%)",
    trial: "hsl(199, 89%, 48%)",
    provisioning: "hsl(38, 92%, 50%)",
    past_due: "hsl(25, 95%, 53%)",
    suspended: "hsl(0, 84%, 60%)",
    deactivated: "hsl(var(--muted-foreground))"
};

export function TenantStatusChart({ data }: { data: TenantStatusData[] }) {
    if (data.length === 0) {
        return (
            <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
                No tenant data
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis
                    dataKey="status"
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    allowDecimals={false}
                />
                <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number | undefined) => [
                        Number(value ?? 0).toLocaleString(),
                        "Tenants"
                    ]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.status] ?? "hsl(var(--primary))"} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
