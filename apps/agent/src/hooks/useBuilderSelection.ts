"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type BuilderSelection = { kind: string; id: string };

export function parseSelectionParam(value?: string | null): BuilderSelection | null {
    if (!value) return null;
    const [kind, ...rest] = value.split(":");
    const id = rest.join(":");
    if (!kind || !id) return null;
    return { kind, id };
}

export function formatSelectionParam(selection: BuilderSelection) {
    return `${selection.kind}:${selection.id}`;
}

export function useBuilderSelection(defaultSelection?: BuilderSelection | null) {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const selectionParam = searchParams?.get("select");

    const parsedSelection = useMemo(
        () => parseSelectionParam(selectionParam) || defaultSelection || null,
        [selectionParam, defaultSelection]
    );

    const [selected, setSelected] = useState<BuilderSelection | null>(parsedSelection);

    useEffect(() => {
        setSelected(parsedSelection);
    }, [parsedSelection]);

    const updateUrl = useCallback(
        (selection: BuilderSelection | null) => {
            const params = new URLSearchParams(searchParams?.toString());
            if (selection) {
                params.set("select", formatSelectionParam(selection));
            } else {
                params.delete("select");
            }
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [pathname, router, searchParams]
    );

    const setSelection = useCallback(
        (selection: BuilderSelection | null) => {
            setSelected(selection);
            updateUrl(selection);
        },
        [updateUrl]
    );

    return {
        selected,
        setSelection
    };
}
