import { vi } from "vitest";

type MCPClientOptions = {
    id?: string;
    servers?: unknown;
    timeout?: number;
};

export class MCPClient {
    static calls: MCPClientOptions[] = [];

    static reset() {
        MCPClient.calls = [];
    }

    listTools = vi.fn().mockResolvedValue({});
    listToolsets = vi.fn().mockResolvedValue({});
    disconnect = vi.fn().mockResolvedValue(undefined);
    callTool = vi.fn().mockResolvedValue({});

    constructor(options: MCPClientOptions) {
        MCPClient.calls.push(options);
    }
}

// Mock InternalMastraMCPClient for the MCP client schema patching
export class InternalMastraMCPClient {
    convertInputSchema = vi.fn().mockResolvedValue({});
}

// Mock MastraMCPServerDefinition type
export type MastraMCPServerDefinition = Record<string, unknown>;
