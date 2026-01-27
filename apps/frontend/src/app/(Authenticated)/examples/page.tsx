import Link from "next/link";
import type { Metadata } from "next";
import {
    Table,
    TableHeader,
    TableBody,
    TableHead,
    TableRow,
    TableCell,
    Badge,
    Button
} from "@repo/ui";

export const metadata: Metadata = {
    title: "Examples List",
    description: "This is a Examples List Page"
};

// Sample data for examples
const examples = [
    {
        id: "example-1",
        name: "Example 1",
        description: "First example demonstrating basic functionality",
        status: "Active",
        lastUpdated: "2024-01-15"
    },
    {
        id: "example-2",
        name: "Example 2",
        description: "Second example showing advanced features",
        status: "Active",
        lastUpdated: "2024-01-20"
    },
    {
        id: "example-3",
        name: "Example 3",
        description: "Third example with experimental features",
        status: "Draft",
        lastUpdated: "2024-01-25"
    }
];

export default function ExamplesListPage() {
    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Examples</h1>
                <p className="text-muted-foreground mt-2">
                    Browse and explore different examples and use cases
                </p>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {examples.map((example) => (
                        <TableRow key={example.id}>
                            <TableCell className="font-medium">
                                <Link
                                    href={`/examples/${example.id}`}
                                    className="hover:text-primary transition-colors hover:underline"
                                >
                                    {example.name}
                                </Link>
                            </TableCell>
                            <TableCell>{example.description}</TableCell>
                            <TableCell>
                                <Badge
                                    variant={example.status === "Active" ? "default" : "secondary"}
                                >
                                    {example.status}
                                </Badge>
                            </TableCell>
                            <TableCell>{example.lastUpdated}</TableCell>
                            <TableCell className="text-right">
                                <Link href={`/examples/${example.id}`}>
                                    <Button variant="ghost" size="sm">
                                        View
                                    </Button>
                                </Link>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
