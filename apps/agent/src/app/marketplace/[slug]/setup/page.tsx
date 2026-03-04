"use client";

import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PlaybookSetupWizard } from "@/components/playbooks/PlaybookSetupWizard";

export default function SetupPage(props: { params: Promise<{ slug: string }> }) {
    const { slug } = use(props.params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const installationId = searchParams.get("installation");

    if (!installationId) {
        return (
            <div className="mx-auto max-w-2xl px-6 py-12 text-center">
                <p className="text-muted-foreground">
                    Missing installation ID. Go back to{" "}
                    <button
                        onClick={() => router.push("/marketplace/installed")}
                        className="text-primary underline"
                    >
                        installed playbooks
                    </button>{" "}
                    and try again.
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl px-6 py-8">
            <button
                onClick={() => router.push(`/marketplace/${slug}`)}
                className="text-muted-foreground hover:text-foreground mb-6 flex items-center gap-2 text-sm"
            >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Marketplace
            </button>

            <PlaybookSetupWizard
                installationId={installationId}
                onComplete={() => router.push("/marketplace/installed")}
            />
        </div>
    );
}
