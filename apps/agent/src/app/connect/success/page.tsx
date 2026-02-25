"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

function ConnectSuccessContent() {
    const searchParams = useSearchParams();
    const provider = searchParams.get("provider");
    const account = searchParams.get("account");
    const error = searchParams.get("error");

    if (error) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-black text-white">
                <div className="mx-auto max-w-sm px-6 text-center">
                    <XCircle className="mx-auto mb-4 size-12 text-red-400" />
                    <h1 className="mb-2 text-xl font-semibold">Connection Failed</h1>
                    <p className="text-muted-foreground mb-6 text-sm">{error}</p>
                    <button
                        onClick={() => window.close()}
                        className="text-muted-foreground hover:text-foreground text-sm underline transition-colors"
                    >
                        Close this tab
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh items-center justify-center bg-black text-white">
            <div className="mx-auto max-w-sm px-6 text-center">
                <CheckCircle2 className="mx-auto mb-4 size-12 text-green-400" />
                <h1 className="mb-2 text-xl font-semibold">
                    {provider ? `${provider} Connected` : "Connected"}
                </h1>
                <p className="text-muted-foreground mb-1 text-sm">
                    {account
                        ? `Your ${provider} account (${account}) is now connected.`
                        : "Your account is now connected."}
                </p>
                <p className="text-muted-foreground mb-6 text-sm">
                    You can close this tab and return to your chat.
                </p>
                <button
                    onClick={() => window.close()}
                    className="inline-flex items-center rounded-full bg-white px-6 py-2 text-sm font-medium text-black transition-colors hover:bg-white/90"
                >
                    Close this tab
                </button>
            </div>
        </div>
    );
}

export default function ConnectSuccessPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-dvh items-center justify-center bg-black">
                    <div className="text-muted-foreground text-sm">Loading...</div>
                </div>
            }
        >
            <ConnectSuccessContent />
        </Suspense>
    );
}
