export { AgentNode } from "./AgentNode";
export { ToolNode } from "./ToolNode";
export { BranchNode } from "./BranchNode";
export { ParallelNode } from "./ParallelNode";
export { ForeachNode } from "./ForeachNode";
export { DoWhileNode } from "./DoWhileNode";
export { HumanNode } from "./HumanNode";
export { DelayNode } from "./DelayNode";
export { SubWorkflowNode } from "./SubWorkflowNode";
export { TransformNode } from "./TransformNode";
export { TriggerNode } from "./TriggerNode";
export { RouterNode } from "./RouterNode";
export { BaseNode } from "./BaseNode";
export type { BuilderNodeData, BuilderNodeStatus } from "./types";

import type { NodeTypes } from "@xyflow/react";
import { AgentNode } from "./AgentNode";
import { ToolNode } from "./ToolNode";
import { BranchNode } from "./BranchNode";
import { ParallelNode } from "./ParallelNode";
import { ForeachNode } from "./ForeachNode";
import { DoWhileNode } from "./DoWhileNode";
import { HumanNode } from "./HumanNode";
import { DelayNode } from "./DelayNode";
import { SubWorkflowNode } from "./SubWorkflowNode";
import { TransformNode } from "./TransformNode";
import { TriggerNode } from "./TriggerNode";
import { RouterNode } from "./RouterNode";

export const builderNodeTypes = {
    agent: AgentNode,
    tool: ToolNode,
    branch: BranchNode,
    parallel: ParallelNode,
    foreach: ForeachNode,
    dowhile: DoWhileNode,
    human: HumanNode,
    delay: DelayNode,
    workflow: SubWorkflowNode,
    transform: TransformNode,
    trigger: TriggerNode,
    router: RouterNode
} as unknown as NodeTypes;
