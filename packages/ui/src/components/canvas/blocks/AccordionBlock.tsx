"use client";

import * as React from "react";
import { CanvasBlock } from "../CanvasBlock";
import { BlockWrapper } from "./BlockWrapper";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "../../../lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AccordionBlock({ config }: { config: any }) {
    const sections = config.sections || [];
    const allowMultiple = config.allowMultiple || false;

    const [openSections, setOpenSections] = React.useState<Set<string>>(() => {
        const initial = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const section of sections as any[]) {
            if (section.defaultOpen) initial.add(section.id);
        }
        return initial;
    });

    const toggleSection = (id: string) => {
        setOpenSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                if (!allowMultiple) next.clear();
                next.add(id);
            }
            return next;
        });
    };

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
            noPadding
        >
            <div className="divide-y">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {sections.map((section: any) => {
                    const isOpen = openSections.has(section.id);
                    return (
                        <div key={section.id}>
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
                            >
                                <span className="text-sm font-medium">{section.label}</span>
                                <ChevronDownIcon
                                    className={cn(
                                        "text-muted-foreground size-4 transition-transform",
                                        isOpen && "rotate-180"
                                    )}
                                />
                            </button>
                            {isOpen && (
                                <div className="px-4 pb-4">
                                    {section.components?.map(
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        (component: any) => (
                                            <div key={component.id} className="mb-4 last:mb-0">
                                                <CanvasBlock component={component} />
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </BlockWrapper>
    );
}
