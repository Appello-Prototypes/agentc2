export default function DemosLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-background min-h-screen">
            <main className="container mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
    );
}
