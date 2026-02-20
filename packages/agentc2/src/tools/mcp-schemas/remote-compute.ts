import type { McpToolDefinition, McpToolRoute } from "./types";

export const remoteComputeToolDefinitions: McpToolDefinition[] = [
    {
        name: "provision-compute",
        description:
            "Provision an ephemeral DigitalOcean Droplet in the customer's account. " +
            "Creates a droplet with Node 20, Bun, Git, and Docker pre-installed. " +
            "Returns connection details and a resource ID for subsequent commands.",
        inputSchema: {
            type: "object",
            properties: {
                region: {
                    type: "string",
                    description:
                        "DigitalOcean region slug (e.g., 'nyc3', 'sfo3', 'ams3'). Default: 'nyc3'"
                },
                size: {
                    type: "string",
                    description:
                        "Droplet size: 'small' (1vCPU/2GB), 'medium' (2vCPU/4GB), 'large' (4vCPU/8GB), " +
                        "or a raw DO slug. Default: 'medium'"
                },
                image: {
                    type: "string",
                    description: "Droplet image slug. Default: 'ubuntu-24-04-x64'"
                },
                ttlMinutes: {
                    type: "number",
                    description:
                        "TTL in minutes (5-180). Droplet destroyed after expiry. Default: 60"
                },
                pipelineRunId: {
                    type: "string",
                    description: "Associated pipeline run ID for tracking"
                }
            },
            required: []
        },
        invoke_url: "/api/mcp",
        category: "remote-compute"
    },
    {
        name: "remote-execute",
        description:
            "Execute a shell command on a provisioned droplet via SSH. " +
            "Use for git clone, bun install, build, test, or any command.",
        inputSchema: {
            type: "object",
            properties: {
                resourceId: {
                    type: "string",
                    description: "Resource ID from provision-compute"
                },
                command: {
                    type: "string",
                    description: "Shell command to execute on the droplet"
                },
                workingDir: {
                    type: "string",
                    description: "Working directory on the droplet (default: /workspace)"
                },
                timeout: {
                    type: "number",
                    description: "Timeout in seconds (5-1800). Default: 300"
                }
            },
            required: ["resourceId", "command"]
        },
        invoke_url: "/api/mcp",
        category: "remote-compute"
    },
    {
        name: "remote-file-transfer",
        description:
            "Transfer files to or from a provisioned droplet. " +
            "Push config files/scripts or pull build logs/test results.",
        inputSchema: {
            type: "object",
            properties: {
                resourceId: {
                    type: "string",
                    description: "Resource ID from provision-compute"
                },
                direction: {
                    type: "string",
                    enum: ["push", "pull"],
                    description:
                        "'push' to send content to droplet, 'pull' to retrieve from droplet"
                },
                content: {
                    type: "string",
                    description: "File content to push (required when direction is 'push')"
                },
                remotePath: {
                    type: "string",
                    description: "Absolute path on the droplet"
                }
            },
            required: ["resourceId", "direction", "remotePath"]
        },
        invoke_url: "/api/mcp",
        category: "remote-compute"
    },
    {
        name: "teardown-compute",
        description:
            "Destroy a provisioned droplet and its SSH key. " +
            "Always call this when done to prevent orphaned infrastructure.",
        inputSchema: {
            type: "object",
            properties: {
                resourceId: {
                    type: "string",
                    description: "Resource ID from provision-compute"
                }
            },
            required: ["resourceId"]
        },
        invoke_url: "/api/mcp",
        category: "remote-compute"
    }
];

export const remoteComputeToolRoutes: McpToolRoute[] = [
    { kind: "registry", name: "provision-compute", injectOrg: true },
    { kind: "registry", name: "remote-execute", injectOrg: true },
    { kind: "registry", name: "remote-file-transfer", injectOrg: true },
    { kind: "registry", name: "teardown-compute", injectOrg: true }
];
