import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthenticatedPage({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        redirect("/");
    }

    console.log("AuthenticatedPage", session);

    return children;
}
