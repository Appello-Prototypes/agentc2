import { Suspense } from "react";
import ClientNav from "./_clientNav";
import Nav from "./_nav";

export default async function ExampleLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="flex h-screen flex-col">
            <header className="p-6">
                <h1 className="text-2xl font-bold">This is a Example Layout for {id}</h1>
                <Suspense fallback={<Nav id={id} currentPath="/" />}>
                    <ClientNav id={id} />
                </Suspense>
            </header>
            <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
    );
}
