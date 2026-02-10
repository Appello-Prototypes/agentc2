"use client";

import * as React from "react";
import { BlockWrapper } from "./BlockWrapper";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function FormBlock({ config }: { config: any }) {
    const [values, setValues] = React.useState<Record<string, unknown>>(() => {
        const defaults: Record<string, unknown> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const field of (config.fields || []) as any[]) {
            if (field.defaultValue != null) {
                defaults[field.name] = field.defaultValue;
            }
        }
        return defaults;
    });
    const [submitted, setSubmitted] = React.useState(false);

    const handleChange = (name: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const action = config.submitAction;
        if (action?.type === "link" && action.href) {
            window.open(action.href, "_blank");
        } else if (action?.type === "navigate" && action.target) {
            window.location.href = action.target;
        }
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 2000);
    };

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(config.fields || []).map((field: any) => (
                    <div key={field.name}>
                        <label className="text-sm font-medium">
                            {field.label}
                            {field.required && <span className="text-red-500"> *</span>}
                        </label>
                        {field.type === "textarea" ? (
                            <textarea
                                value={String(values[field.name] ?? "")}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                placeholder={field.placeholder}
                                required={field.required}
                                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                                rows={3}
                            />
                        ) : field.type === "select" ? (
                            <select
                                value={String(values[field.name] ?? "")}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                required={field.required}
                                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            >
                                <option value="">{field.placeholder || "Select..."}</option>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {(field.options || []).map((opt: any) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        ) : field.type === "checkbox" ? (
                            <div className="mt-1 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={!!values[field.name]}
                                    onChange={(e) => handleChange(field.name, e.target.checked)}
                                    className="size-4 rounded border"
                                />
                            </div>
                        ) : field.type === "radio" ? (
                            <div className="mt-1 space-y-1">
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {(field.options || []).map((opt: any) => (
                                    <label
                                        key={opt.value}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <input
                                            type="radio"
                                            name={field.name}
                                            value={opt.value}
                                            checked={values[field.name] === opt.value}
                                            onChange={() => handleChange(field.name, opt.value)}
                                            className="size-4"
                                        />
                                        {opt.label}
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <input
                                type={field.type || "text"}
                                value={String(values[field.name] ?? "")}
                                onChange={(e) => handleChange(field.name, e.target.value)}
                                placeholder={field.placeholder}
                                required={field.required}
                                className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                            />
                        )}
                    </div>
                ))}
                <button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
                >
                    {submitted ? "Submitted!" : config.submitLabel || "Submit"}
                </button>
            </form>
        </BlockWrapper>
    );
}
