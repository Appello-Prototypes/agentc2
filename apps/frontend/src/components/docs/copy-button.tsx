"use client";

import { useState, useCallback } from "react";

export function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className="absolute top-2 right-2 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 hover:text-white/80"
            aria-label="Copy code"
        >
            {copied ? "Copied" : "Copy"}
        </button>
    );
}
