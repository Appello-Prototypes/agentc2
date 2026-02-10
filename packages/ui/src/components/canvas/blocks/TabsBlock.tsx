"use client";

import * as React from "react";
import { CanvasBlock } from "../CanvasBlock";
import { BlockWrapper } from "./BlockWrapper";
import { cn } from "../../../lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TabsBlock({ config }: { config: any }) {
    const tabs = config.tabs || [];
    const [activeTab, setActiveTab] = React.useState<string>(
        config.defaultTab || tabs[0]?.id || ""
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeTabData = tabs.find((t: any) => t.id === activeTab);

    return (
        <BlockWrapper
            title={config.title}
            description={config.description}
            className={config.className}
            noPadding
        >
            {/* Tab headers */}
            <div className="flex border-b">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {tabs.map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "px-4 py-2 text-sm font-medium transition-colors",
                            activeTab === tab.id
                                ? "border-primary text-foreground border-b-2"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="p-4">
                {activeTabData?.components?.map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (component: any) => (
                        <div key={component.id} className="mb-4 last:mb-0">
                            <CanvasBlock component={component} />
                        </div>
                    )
                )}
            </div>
        </BlockWrapper>
    );
}
