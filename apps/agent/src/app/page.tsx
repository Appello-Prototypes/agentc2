import { redirect } from "next/navigation";

export default function AgentHomePage() {
    // Redirect to the main playground overview
    redirect("/demos");
}
