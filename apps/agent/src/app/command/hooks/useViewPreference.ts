"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { ViewMode } from "../types";

const STORAGE_KEY = "command-center-view";
const DEFAULT_VIEW: ViewMode = "grid";
const VALID_VIEWS: ViewMode[] = ["pipeline", "grid", "timeline", "inbox", "topology", "legacy"];

let listeners: Array<() => void> = [];
function emitChange() {
    for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
    listeners = [...listeners, listener];
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
}

function getSnapshot(): ViewMode {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && VALID_VIEWS.includes(stored as ViewMode)) {
            return stored as ViewMode;
        }
    } catch {
        /* localStorage unavailable */
    }
    return DEFAULT_VIEW;
}

function getServerSnapshot(): ViewMode {
    return DEFAULT_VIEW;
}

export function useViewPreference() {
    const viewMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const setViewMode = useCallback((mode: ViewMode) => {
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {
            /* localStorage unavailable */
        }
        emitChange();
    }, []);

    return { viewMode, setViewMode };
}
