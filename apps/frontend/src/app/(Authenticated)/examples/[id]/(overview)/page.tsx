import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Example Overview",
    description: "This is a Example Overview Page"
};

export default async function ExampleOverviewPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">This is a Example Overview Page</h1>
        </div>
    );
}
