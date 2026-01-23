import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sales Dashboard",
    description: "This is a Sales Dashboard"
};

export default async function DashboardPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">This is a SalesDashboard Page</h1>
        </div>
    );
}
