export default function DemosLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-background h-full overflow-y-auto">
            <main className="container mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
    );
}
