"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error" | "conflict";

interface AutoSaveOptions {
    debounceMs?: number;
    enabled?: boolean;
}

export function useAutoSave(
    saveFn: () => Promise<{ success: boolean; status?: number; currentVersion?: number }>,
    isDirty: boolean,
    options: AutoSaveOptions = {}
) {
    const { debounceMs = 2000, enabled = true } = options;
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savingRef = useRef(false);

    const save = useCallback(async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSaveStatus("saving");
        try {
            const result = await saveFn();
            if (result.status === 409) {
                setSaveStatus("conflict");
            } else if (result.success) {
                setSaveStatus("saved");
                setLastSavedAt(new Date());
            } else {
                setSaveStatus("error");
            }
        } catch {
            setSaveStatus("error");
        } finally {
            savingRef.current = false;
        }
    }, [saveFn]);

    useEffect(() => {
        if (!enabled || !isDirty) return;

        setSaveStatus("unsaved");

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            save();
        }, debounceMs);

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isDirty, enabled, debounceMs, save]);

    const saveNow = useCallback(async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        await save();
    }, [save]);

    return { saveStatus, saveNow, lastSavedAt };
}
