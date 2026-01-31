export { dateTimeTool, calculatorTool, generateIdTool, tools } from "./example-tools";
export { webFetchTool } from "./web-fetch";
export { memoryRecallTool } from "./memory-recall";
export { workflowTriggerTool } from "./workflow-trigger";
export { jsonParserTool } from "./json-parser";

import { dateTimeTool, calculatorTool, generateIdTool } from "./example-tools";
import { webFetchTool } from "./web-fetch";
import { jsonParserTool } from "./json-parser";

// Extended tools bundle (includes web and parsing)
export const extendedTools = {
    dateTimeTool,
    calculatorTool,
    generateIdTool,
    webFetchTool,
    jsonParserTool
};
