import { redirect } from "next/navigation";

export default function HomePage() {
    // Redirect to workspace as the default landing page
    redirect("/workspace");
}
