import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ingestBimElementsToRag, ingestBimModel, uploadBimObject } from "@repo/mastra";
import { getDemoSession } from "@/lib/standalone-auth";

function getExtension(filename: string) {
    const parts = filename.toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() || "" : "";
}

function detectSourceFormat(filename: string, explicit?: string | null) {
    if (explicit) {
        return explicit.toLowerCase();
    }
    const ext = getExtension(filename);
    if (ext === "ifc") {
        return "ifc";
    }
    if (ext === "csv") {
        return "csv";
    }
    if (ext === "json") {
        return "json";
    }
    if (ext === "nwd" || ext === "rvt" || ext === "dwg") {
        return "speckle";
    }
    return ext || "json";
}

function parseJsonField(value: FormDataEntryValue | null) {
    if (!value || typeof value !== "string" || value.trim() === "") {
        return undefined;
    }
    try {
        return JSON.parse(value);
    } catch {
        throw new Error("Invalid JSON field provided.");
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getDemoSession();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            const file = formData.get("file") as File | null;
            if (!file) {
                return NextResponse.json({ error: "File is required" }, { status: 400 });
            }

            const modelName = (formData.get("modelName") as string | null) || file.name;
            const sourceFormat = detectSourceFormat(
                file.name,
                formData.get("sourceFormat") as string | null
            );
            const workspaceId = formData.get("workspaceId") as string | null;
            const ownerId = formData.get("ownerId") as string | null;
            const metadata = parseJsonField(formData.get("metadata"));
            const adapterInput = parseJsonField(formData.get("adapterInput"));
            const ingestToRag = (formData.get("ingestToRag") as string | null) === "true";

            const buffer = Buffer.from(await file.arrayBuffer());
            const checksum = createHash("sha256").update(buffer).digest("hex");

            const uploadKey = `bim/${Date.now()}_${file.name}`;
            const uploadResult = await uploadBimObject({
                key: uploadKey,
                body: buffer,
                contentType: file.type || "application/octet-stream"
            });

            let resolvedAdapterInput = adapterInput;
            if (!resolvedAdapterInput) {
                if (sourceFormat === "csv") {
                    resolvedAdapterInput = { csv: buffer.toString("utf-8") };
                } else if (sourceFormat === "json") {
                    resolvedAdapterInput = JSON.parse(buffer.toString("utf-8"));
                } else {
                    return NextResponse.json(
                        {
                            error: "Binary formats require a normalized adapterInput payload (e.g., IFC/Speckle JSON)."
                        },
                        { status: 400 }
                    );
                }
            }

            const result = await ingestBimModel({
                modelName,
                workspaceId: workspaceId || undefined,
                ownerId: ownerId || undefined,
                sourceFormat,
                sourceKey: uploadResult.key,
                sourceUri: `spaces://${uploadResult.bucket}/${uploadResult.key}`,
                checksum,
                metadata,
                adapterInput: resolvedAdapterInput
            });

            const ragResult = ingestToRag
                ? await ingestBimElementsToRag({ versionId: result.versionId })
                : null;

            return NextResponse.json({ ...result, rag: ragResult });
        }

        const body = await request.json();
        if (!body.modelName || !body.sourceFormat || !body.adapterInput) {
            return NextResponse.json(
                { error: "modelName, sourceFormat, and adapterInput are required" },
                { status: 400 }
            );
        }
        const result = await ingestBimModel({
            modelId: body.modelId,
            modelName: body.modelName,
            workspaceId: body.workspaceId,
            ownerId: body.ownerId,
            sourceFormat: body.sourceFormat,
            sourceUri: body.sourceUri,
            sourceKey: body.sourceKey,
            checksum: body.checksum,
            metadata: body.metadata,
            adapterInput: body.adapterInput
        });

        const ragResult = body.ingestToRag
            ? await ingestBimElementsToRag({ versionId: result.versionId })
            : null;

        return NextResponse.json({ ...result, rag: ragResult });
    } catch (error) {
        console.error("BIM ingest error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Ingest failed" },
            { status: 500 }
        );
    }
}
