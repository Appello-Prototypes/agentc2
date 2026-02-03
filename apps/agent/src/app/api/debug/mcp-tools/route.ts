import { NextResponse } from "next/server";
import { getAllMcpTools } from "@repo/mastra";

/**
 * Debug endpoint to inspect MCP tool schemas
 * Shows what the agent resolver sees when loading tools
 */
export async function GET() {
    try {
        const mcpTools = await getAllMcpTools();
        const toolNames = Object.keys(mcpTools);
        
        const analysis = [];
        
        for (const [name, tool] of Object.entries(mcpTools)) {
            const t = tool as any;
            
            // Check schema structure
            const isZodSchema = t.inputSchema && typeof t.inputSchema.parse === 'function';
            const typeName = isZodSchema ? t.inputSchema._def?.typeName : null;
            const isZodObject = typeName === 'ZodObject';
            const hasJsonSchema = t.inputSchema && typeof t.inputSchema.type === 'string';
            const isApiClient = t._apiClient === true;
            
            // Check if this would pass our filter
            const wouldPass = isZodObject || hasJsonSchema || isApiClient;
            
            analysis.push({
                name,
                isZodSchema,
                typeName,
                isZodObject,
                hasJsonSchema,
                isApiClient,
                wouldPass,
                hasCustom: 'custom' in t,
                customInputSchemaType: t.custom?.input_schema?.type,
            });
        }
        
        // Find tools that would be filtered out
        const filtered = analysis.filter(a => !a.wouldPass);
        const justcallFiltered = filtered.filter(a => a.name.includes('justcall'));
        
        return NextResponse.json({
            totalTools: toolNames.length,
            wouldFilter: filtered.length,
            justcallWouldFilter: justcallFiltered.length,
            filteredTools: filtered.slice(0, 10), // First 10 that would be filtered
            // Show tool 66's info (0-indexed: 65)
            tool66: analysis.find(a => a.name.includes('import_salesdialer_contacts') && !a.name.includes('status')),
            // All JustCall tools schema analysis
            justcallAnalysis: analysis.filter(a => a.name.includes('justcall')).map(a => ({
                name: a.name,
                typeName: a.typeName,
                wouldPass: a.wouldPass,
                customInputSchemaType: a.customInputSchemaType
            }))
        });
    } catch (error) {
        console.error("Debug error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Debug failed" },
            { status: 500 }
        );
    }
}
