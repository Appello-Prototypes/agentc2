"use client";

import * as React from "react";
import { DataTableBlock } from "./blocks/DataTableBlock";
import { BarChartBlock } from "./blocks/BarChartBlock";
import { LineChartBlock } from "./blocks/LineChartBlock";
import { PieChartBlock } from "./blocks/PieChartBlock";
import { AreaChartBlock } from "./blocks/AreaChartBlock";
import { KPICardBlock } from "./blocks/KPICardBlock";
import { TextBlock } from "./blocks/TextBlock";
import { FilterBarBlock } from "./blocks/FilterBarBlock";
import { DetailViewBlock } from "./blocks/DetailViewBlock";
import { PropertyListBlock } from "./blocks/PropertyListBlock";
import { TimelineBlock } from "./blocks/TimelineBlock";
import { KanbanBlock } from "./blocks/KanbanBlock";
import { ListBlock } from "./blocks/ListBlock";
import { FormBlock } from "./blocks/FormBlock";
import { ActionButtonBlock } from "./blocks/ActionButtonBlock";
import { SparklineBlock } from "./blocks/SparklineBlock";
import { FunnelBlock } from "./blocks/FunnelBlock";
import { SearchBlock } from "./blocks/SearchBlock";
import { TabsBlock } from "./blocks/TabsBlock";
import { AccordionBlock } from "./blocks/AccordionBlock";

/**
 * Block dispatcher - routes to the correct block component based on type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CanvasBlock({ component }: { component: any }) {
    switch (component.type) {
        case "data-table":
            return <DataTableBlock config={component} />;
        case "bar-chart":
            return <BarChartBlock config={component} />;
        case "line-chart":
            return <LineChartBlock config={component} />;
        case "pie-chart":
            return <PieChartBlock config={component} />;
        case "area-chart":
            return <AreaChartBlock config={component} />;
        case "kpi-card":
            return <KPICardBlock config={component} />;
        case "text":
            return <TextBlock config={component} />;
        case "filter-bar":
            return <FilterBarBlock config={component} />;
        case "detail-view":
            return <DetailViewBlock config={component} />;
        case "property-list":
            return <PropertyListBlock config={component} />;
        case "timeline":
            return <TimelineBlock config={component} />;
        case "kanban":
            return <KanbanBlock config={component} />;
        case "list":
            return <ListBlock config={component} />;
        case "form":
            return <FormBlock config={component} />;
        case "action-button":
            return <ActionButtonBlock config={component} />;
        case "sparkline":
            return <SparklineBlock config={component} />;
        case "funnel":
            return <FunnelBlock config={component} />;
        case "search":
            return <SearchBlock config={component} />;
        case "tabs":
            return <TabsBlock config={component} />;
        case "accordion":
            return <AccordionBlock config={component} />;
        default:
            return (
                <div className="rounded-lg border border-dashed p-4 text-center">
                    <p className="text-muted-foreground text-sm">
                        Unknown block type: <code>{component.type}</code>
                    </p>
                </div>
            );
    }
}
