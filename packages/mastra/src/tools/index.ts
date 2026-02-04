export { dateTimeTool, calculatorTool, generateIdTool, tools } from "./example-tools";
export { webFetchTool } from "./web-fetch";
export { memoryRecallTool } from "./memory-recall";
export { workflowTriggerTool } from "./workflow-trigger";
export { jsonParserTool } from "./json-parser";
export { workflowExecuteTool, workflowListRunsTool, workflowGetRunTool } from "./workflow-tools";
export { networkExecuteTool, networkListRunsTool, networkGetRunTool } from "./network-tools";
export {
    bimQueryTool,
    bimTakeoffTool,
    bimDiffTool,
    bimClashTool,
    bimHandoverTool
} from "./bim-tools";

// Tool registry for stored agents
export {
    toolRegistry,
    listAvailableTools,
    getToolsByNames,
    getToolsByNamesAsync,
    getToolByName,
    hasToolInRegistry,
    getAllMcpTools
} from "./registry";
export type { ToolInfo } from "./registry";

import { dateTimeTool, calculatorTool, generateIdTool } from "./example-tools";
import { webFetchTool } from "./web-fetch";
import { jsonParserTool } from "./json-parser";
import { workflowExecuteTool, workflowListRunsTool, workflowGetRunTool } from "./workflow-tools";
import { networkExecuteTool, networkListRunsTool, networkGetRunTool } from "./network-tools";
import {
    bimQueryTool,
    bimTakeoffTool,
    bimDiffTool,
    bimClashTool,
    bimHandoverTool
} from "./bim-tools";

// Extended tools bundle (includes web and parsing)
export const extendedTools = {
    dateTimeTool,
    calculatorTool,
    generateIdTool,
    webFetchTool,
    jsonParserTool,
    workflowExecuteTool,
    workflowListRunsTool,
    workflowGetRunTool,
    networkExecuteTool,
    networkListRunsTool,
    networkGetRunTool,
    bimQueryTool,
    bimTakeoffTool,
    bimDiffTool,
    bimClashTool,
    bimHandoverTool
};
