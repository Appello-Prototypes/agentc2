import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Example Settings",
    description: "This is a Example Settings Page"
};

export default function ExampleSettingsPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">This is a Example Settings Page</h1>
        </div>
    );
}
