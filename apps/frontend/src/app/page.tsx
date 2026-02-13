import { auth } from "@repo/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { LandingPage } from "./landing-page";

export default async function HomePage() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (session) {
        redirect("/workspace");
    }

    return <LandingPage />;
}
