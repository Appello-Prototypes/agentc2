"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getApiBase } from "@/lib/utils";

type BootstrapState = "loading" | "error";

function BootstrapInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [state, setState] = useState<BootstrapState>("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const bootstrappedRef = useRef(false);

    const dt = searchParams.get("dt");
    const identity = searchParams.get("identity");

    useEffect(() => {
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;

        if (!dt || !identity) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: validating required params on mount
            setState("error");
            setErrorMsg("Missing deployment token or identity parameter.");
            return;
        }

        let cancelled = false;

        async function bootstrap() {
            try {
                const res = await fetch(`${getApiBase()}/api/partner/session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        deploymentToken: dt,
                        identityToken: identity
                    })
                });

                if (cancelled) return;

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setState("error");
                    setErrorMsg(data.error || `Session creation failed (${res.status})`);
                    return;
                }

                const data = await res.json();
                if (data.success && data.redirectTo) {
                    router.replace(data.redirectTo);
                } else {
                    router.replace("/workspace");
                }
            } catch (err) {
                if (cancelled) return;
                setState("error");
                setErrorMsg(
                    err instanceof Error ? err.message : "Network error — please try again."
                );
            }
        }

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, [dt, identity, router]);

    return (
        <>
            {state === "loading" && (
                <div className="flex flex-col items-center gap-4">
                    <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
                    <p className="text-muted-foreground text-sm">Setting up your workspace...</p>
                </div>
            )}
            {state === "error" && (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                    <p className="text-destructive text-sm font-medium">Failed to load workspace</p>
                    <p className="text-muted-foreground max-w-sm text-xs">{errorMsg}</p>
                </div>
            )}
        </>
    );
}

export default function EmbedWorkspaceBootstrap() {
    return (
        <div className="bg-background flex h-dvh w-full items-center justify-center">
            <Suspense
                fallback={
                    <div className="flex flex-col items-center gap-4">
                        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
                        <p className="text-muted-foreground text-sm">Loading...</p>
                    </div>
                }
            >
                <BootstrapInner />
            </Suspense>
        </div>
    );
}
