import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Dashboard",
    description: "This is a Dashboard"
};

export default async function DashboardPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">This is Dashboard Page</h1>
        </div>
    );
}
