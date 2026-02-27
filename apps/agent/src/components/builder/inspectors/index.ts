export { AgentInspector } from "./AgentInspector";
export { ToolInspector } from "./ToolInspector";
export { BranchInspector } from "./BranchInspector";
export { ParallelInspector } from "./ParallelInspector";
export { ForeachInspector } from "./ForeachInspector";
export { DoWhileInspector } from "./DoWhileInspector";
export { HumanInspector } from "./HumanInspector";
export { DelayInspector } from "./DelayInspector";
export { SubWorkflowInspector } from "./SubWorkflowInspector";
export { TransformInspector } from "./TransformInspector";
export { EdgeInspector } from "./EdgeInspector";
export { RouterInspector } from "./RouterInspector";
export { PrimitiveInspector } from "./PrimitiveInspector";

import type { ReactNode } from "react";
import { AgentInspector } from "./AgentInspector";
import { ToolInspector } from "./ToolInspector";
import { BranchInspector } from "./BranchInspector";
import { ParallelInspector } from "./ParallelInspector";
import { ForeachInspector } from "./ForeachInspector";
import { DoWhileInspector } from "./DoWhileInspector";
import { HumanInspector } from "./HumanInspector";
import { DelayInspector } from "./DelayInspector";
import { SubWorkflowInspector } from "./SubWorkflowInspector";
import { TransformInspector } from "./TransformInspector";

interface InspectorRendererProps {
    stepType: string;
    config: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
}

export function getStepInspector({
    stepType,
    config,
    onChange
}: InspectorRendererProps): ReactNode {
    switch (stepType) {
        case "agent":
            return AgentInspector({ config, onChange });
        case "tool":
            return ToolInspector({ config, onChange });
        case "branch":
            return BranchInspector({ config, onChange });
        case "parallel":
            return ParallelInspector({ config, onChange });
        case "foreach":
            return ForeachInspector({ config, onChange });
        case "dowhile":
            return DoWhileInspector({ config, onChange });
        case "human":
            return HumanInspector({ config, onChange });
        case "delay":
            return DelayInspector({ config, onChange });
        case "workflow":
            return SubWorkflowInspector({ config, onChange });
        case "transform":
            return TransformInspector({ config, onChange });
        default:
            return null;
    }
}
