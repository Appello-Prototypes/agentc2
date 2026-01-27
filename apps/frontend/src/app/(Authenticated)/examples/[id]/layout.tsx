import { Suspense } from "react";
import Link from "next/link";
import ClientNav from "./_clientNav";
import Nav from "./_nav";
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@repo/ui";

export default async function ExampleLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    // Format the ID for display (e.g., "example-1" -> "Example 1")
    const displayName = id
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return (
        <div className="flex h-screen flex-col">
            <header className="space-y-4 border-b p-6">
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink render={(props) => <Link {...props} href="/" />}>
                                Home
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbLink
                                render={(props) => <Link {...props} href="/examples" />}
                            >
                                Examples
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>{displayName}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <h1 className="text-2xl font-bold">{displayName}</h1>

                <Suspense fallback={<Nav id={id} currentPath="/" />}>
                    <ClientNav id={id} />
                </Suspense>
            </header>
            <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
    );
}
