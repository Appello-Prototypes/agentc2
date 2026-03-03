/**
 * Boot prompt template for playbook-deployed agents.
 *
 * Sent as the first message when autoBootEnabled is true.
 * The agent reads its boot runbook from RAG and self-configures.
 */

export function buildBootPrompt(opts: {
    agentName: string;
    playbookName: string;
    playbookSlug: string;
}): string {
    return `You have just been deployed as part of the "${opts.playbookName}" playbook. Your name is ${opts.agentName}.

This is your boot sequence. Follow these steps:

1. **Read your boot runbook**: Query the knowledge base for documents tagged "playbook-boot" or categorized as "boot-runbook". This document contains your deployment-specific configuration instructions.

2. **Assess your environment**: Check which integrations and tools are available to you. Note any missing capabilities that the boot runbook mentions.

3. **Create contextual tasks**: Based on what you learn from the boot runbook and your environment assessment, create backlog tasks for any setup work that needs to be done. Use the backlog-add-task tool with source "playbook-boot" and appropriate priorities.

4. **Execute structural tasks**: Check your existing backlog for any pre-seeded tasks (these were created during deployment). Work through them in priority order.

5. **Report status**: After completing your boot sequence, summarize what was configured, what tasks were created, and any issues encountered.

Begin by reading your boot runbook document now.`;
}
