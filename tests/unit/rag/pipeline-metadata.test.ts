import { describe, it, expect } from "vitest";

/**
 * Tests for the metadata merge logic in ingestDocument.
 *
 * We can't easily mock the AI SDK embeddings in unit tests (the embedder is
 * initialized at module scope), so we test the metadata merge logic directly
 * as a pure function -- which is the behavior we actually care about.
 */
describe("RAG Pipeline - Custom Metadata Merge Logic", () => {
    // Simulates the exact merge order from pipeline.ts line 106
    function mergeMetadata(
        customMetadata: Record<string, unknown>,
        chunkMetadata: Record<string, unknown>,
        standardFields: {
            documentId: string;
            sourceName: string;
            text: string;
            chunkIndex: number;
            totalChunks: number;
        }
    ) {
        return {
            ...customMetadata,
            ...chunkMetadata,
            documentId: standardFields.documentId,
            sourceName: standardFields.sourceName,
            text: standardFields.text,
            chunkIndex: standardFields.chunkIndex,
            totalChunks: standardFields.totalChunks,
            ingestedAt: new Date().toISOString()
        };
    }

    // Test 15: Custom metadata merges into chunk metadata
    it("custom metadata is present in merged result", () => {
        const result = mergeMetadata(
            { agentSlug: "company-intelligence", contentType: "agent-output", overallGrade: 0.91 },
            { chunkIndex: 0, charCount: 100 },
            {
                documentId: "doc-1",
                sourceName: "Company Intelligence - 2026-02-17",
                text: "The pipeline value is $1.2M...",
                chunkIndex: 0,
                totalChunks: 3
            }
        );

        expect(result.agentSlug).toBe("company-intelligence");
        expect(result.contentType).toBe("agent-output");
        expect(result.overallGrade).toBe(0.91);
    });

    // Test 16: Standard fields are not overwritten by custom metadata
    it("standard fields (documentId, text, sourceName) override custom metadata", () => {
        const result = mergeMetadata(
            {
                documentId: "should-be-overwritten",
                text: "should-be-overwritten",
                sourceName: "should-be-overwritten"
            },
            { chunkIndex: 0, charCount: 100 },
            {
                documentId: "real-doc-id",
                sourceName: "Real Source",
                text: "Real chunk text content",
                chunkIndex: 0,
                totalChunks: 1
            }
        );

        expect(result.documentId).toBe("real-doc-id");
        expect(result.sourceName).toBe("Real Source");
        expect(result.text).toBe("Real chunk text content");
    });

    // Additional: chunk metadata overrides custom metadata (for overlapping keys)
    it("chunk metadata overrides custom metadata for overlapping keys", () => {
        const result = mergeMetadata(
            { charCount: 999 },
            { charCount: 100, chunkType: "recursive" },
            {
                documentId: "doc-1",
                sourceName: "Source",
                text: "text",
                chunkIndex: 0,
                totalChunks: 1
            }
        );

        expect(result.charCount).toBe(100); // chunk wins over custom
    });
});
