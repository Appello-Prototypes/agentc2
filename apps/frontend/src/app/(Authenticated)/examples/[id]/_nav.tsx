import { cn } from "@repo/ui";
import Link from "next/link";

export default function Nav({ id, currentPath }: { id: string; currentPath: string }) {
    const navItems = [
        {
            label: "Overview",
            href: `/examples/${id}`
        },
        {
            label: "Settings",
            href: `/examples/${id}/settings`
        }
    ];

    return (
        <nav className="flex gap-2">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        currentPath === item.href ? "text-primary" : "text-muted-foreground"
                    )}
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
