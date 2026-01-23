import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Examples List",
    description: "This is a Examples List Page"
};

export default function ExamplesListPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold">This is a Examples List Page</h1>
            <ul>
                <li>
                    <Link href="/examples/example-1">Example 1</Link>
                </li>
                <li>
                    <Link href="/examples/example-2">Example 2</Link>
                </li>
            </ul>
        </div>
    );
}
