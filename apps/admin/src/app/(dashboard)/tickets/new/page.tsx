import { prisma } from "@repo/database";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CreateTicketForm } from "./create-ticket-form";

export const dynamic = "force-dynamic";

export default async function NewTicketPage() {
    const [organizations, adminUsers] = await Promise.all([
        prisma.organization.findMany({
            where: { status: "active" },
            select: { id: true, name: true, slug: true },
            orderBy: { name: "asc" }
        }),
        prisma.adminUser.findMany({
            where: { isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" }
        })
    ]);

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div className="flex items-center gap-2">
                <Link
                    href="/tickets"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Tickets
                </Link>
            </div>

            <h1 className="text-2xl font-bold">Create Ticket</h1>

            <CreateTicketForm organizations={organizations} adminUsers={adminUsers} />
        </div>
    );
}
