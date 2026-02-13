import { prisma } from "@repo/database";
import { Flag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
    const flags = await prisma.featureFlag.findMany({
        orderBy: { key: "asc" },
        include: {
            _count: { select: { overrides: true } }
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Feature Flags</h1>
                <span className="text-muted-foreground text-sm">{flags.length} flags defined</span>
            </div>

            <div className="bg-card border-border overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-border border-b">
                            <th className="px-4 py-3 text-left font-medium">Flag</th>
                            <th className="px-4 py-3 text-left font-medium">Type</th>
                            <th className="px-4 py-3 text-left font-medium">Default</th>
                            <th className="px-4 py-3 text-left font-medium">Active</th>
                            <th className="px-4 py-3 text-left font-medium">Overrides</th>
                            <th className="px-4 py-3 text-left font-medium">Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {flags.map((flag) => (
                            <tr key={flag.id} className="border-border border-b last:border-0">
                                <td className="px-4 py-3">
                                    <div className="font-medium">{flag.name}</div>
                                    <div className="text-muted-foreground font-mono text-xs">
                                        {flag.key}
                                    </div>
                                    {flag.description && (
                                        <div className="text-muted-foreground mt-0.5 text-xs">
                                            {flag.description}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">
                                        {flag.flagType}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs">{flag.defaultValue}</td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`inline-flex h-2 w-2 rounded-full ${flag.isActive ? "bg-green-500" : "bg-gray-400"}`}
                                    />
                                </td>
                                <td className="px-4 py-3">
                                    {flag._count.overrides > 0 ? (
                                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-500">
                                            {flag._count.overrides}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">0</span>
                                    )}
                                </td>
                                <td className="text-muted-foreground px-4 py-3 text-xs">
                                    {flag.updatedAt.toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        {flags.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="text-muted-foreground px-4 py-8 text-center"
                                >
                                    <Flag className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                    No feature flags defined yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
