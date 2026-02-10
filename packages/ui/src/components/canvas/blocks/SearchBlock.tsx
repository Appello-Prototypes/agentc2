"use client";

import * as React from "react";
import { useCanvasData } from "../CanvasRenderer";
import { SearchIcon } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SearchBlock({ config }: { config: any }) {
    const { setFilter } = useCanvasData();
    const [value, setValue] = React.useState("");
    const debounceMs = config.debounceMs || 300;
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setValue(newValue);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setFilter(`${config.queryId}__${config.paramKey}`, newValue);
        }, debounceMs);
    };

    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return (
        <div className={config.className}>
            {config.title && (
                <label className="mb-1 block text-sm font-medium">{config.title}</label>
            )}
            <div className="relative">
                <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <input
                    type="text"
                    value={value}
                    onChange={handleChange}
                    placeholder={config.placeholder || "Search..."}
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border py-2 pr-4 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                />
            </div>
        </div>
    );
}
