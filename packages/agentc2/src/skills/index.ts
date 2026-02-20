export {
    createSkill,
    updateSkill,
    deleteSkill,
    getSkill,
    listSkills,
    attachDocument,
    detachDocument,
    attachTool,
    detachTool,
    attachToAgent,
    detachFromAgent,
    getSkillVersions,
    forkSkill,
    // Aliased re-exports for backward compatibility with barrel consumers
    attachDocument as skillAttachDocument,
    detachDocument as skillDetachDocument,
    attachTool as skillAttachTool,
    detachTool as skillDetachTool,
    attachToAgent as skillAttachToAgent,
    detachFromAgent as skillDetachFromAgent,
    type CreateSkillInput,
    type UpdateSkillInput,
    type ListSkillsInput
} from "./service";

export {
    getThreadSkillState,
    addThreadSkillActivations,
    setThreadSkillState,
    clearThreadSkillState
} from "./thread-state";

export { generateSkillForMcpServer, mcpSkillExists, getMcpSkillSlug } from "./auto-generator";

export { recommendSkills } from "./recommender";
