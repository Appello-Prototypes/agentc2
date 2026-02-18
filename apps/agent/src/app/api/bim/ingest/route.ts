import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ingestBimElementsToRag, ingestBimModel, uploadBimObject } from "@repo/mastra/bim";
import { inngest } from "@/lib/inngest";
import { getDefaultWorkspaceIdForUser } from "@/lib/organization";
import { getDemoSession } from "@/lib/standalone-auth";

const MAX_BIM_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

function getExtension(filename: string) {
    const parts = filename.toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() || "" : "";
}

function sanitizeFilename(filename: string): string {
    return (
        filename
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/^_+/, "")
            .slice(0, 120) || "upload"
    );
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
    if (ext === "nwd") {
        return "nwd";
    }
    if (ext === "rvt" || ext === "dwg") {
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
            if (file.size > MAX_BIM_UPLOAD_BYTES) {
                return NextResponse.json(
                    { error: `File exceeds size limit of ${MAX_BIM_UPLOAD_BYTES} bytes` },
                    { status: 413 }
                );
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
            let resolvedWorkspaceId = workspaceId;
            if (!resolvedWorkspaceId) {
                resolvedWorkspaceId = await getDefaultWorkspaceIdForUser(session.user.id);
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const checksum = createHash("sha256").update(buffer).digest("hex");

            const uploadKey = `bim/${Date.now()}_${sanitizeFilename(file.name)}`;
            const uploadResult = await uploadBimObject({
                key: uploadKey,
                body: buffer,
                contentType: file.type || "application/octet-stream"
            });

            // Handle binary formats that need external conversion (NWD, RVT, etc.)
            if (sourceFormat === "nwd") {
                // NWD files are stored and queued for conversion
                // They cannot be parsed directly - require Navisworks or conversion service
                const { prisma } = await import("@repo/database");

                // Create model with QUEUED status
                const model = await prisma.bimModel.create({
                    data: {
                        name: modelName,
                        workspaceId: resolvedWorkspaceId
                    }
                });

                const version = await prisma.bimModelVersion.create({
                    data: {
                        modelId: model.id,
                        version: 1,
                        status: "QUEUED",
                        sourceFormat: "nwd",
                        checksum,
                        sourceUri: `spaces://${uploadResult.bucket}/${uploadResult.key}`,
                        metadata: metadata || {}
                    }
                });

                return NextResponse.json({
                    modelId: model.id,
                    versionId: version.id,
                    elementCount: 0,
                    status: "QUEUED",
                    message:
                        "NWD file uploaded successfully. The file has been stored and queued for conversion. " +
                        "NWD is a proprietary Navisworks format that requires external conversion to IFC or JSON before elements can be extracted."
                });
            }

            let resolvedAdapterInput = adapterInput;
            if (!resolvedAdapterInput) {
                if (sourceFormat === "csv") {
                    resolvedAdapterInput = { csv: buffer.toString("utf-8") };
                } else if (sourceFormat === "json") {
                    resolvedAdapterInput = JSON.parse(buffer.toString("utf-8"));
                } else if (sourceFormat === "ifc") {
                    // IFC files also need conversion - store and queue
                    const { prisma } = await import("@repo/database");

                    const model = await prisma.bimModel.create({
                        data: {
                            name: modelName,
                            workspaceId: resolvedWorkspaceId
                        }
                    });

                    const version = await prisma.bimModelVersion.create({
                        data: {
                            modelId: model.id,
                            version: 1,
                            status: "QUEUED",
                            sourceFormat: "ifc",
                            checksum,
                            sourceUri: `spaces://${uploadResult.bucket}/${uploadResult.key}`,
                            metadata: metadata || {}
                        }
                    });

                    await inngest.send({
                        name: "bim/ifc.parse",
                        data: {
                            modelId: model.id,
                            versionId: version.id,
                            sourceKey: uploadResult.key,
                            sourceUri: `spaces://${uploadResult.bucket}/${uploadResult.key}`
                        }
                    });

                    return NextResponse.json({
                        modelId: model.id,
                        versionId: version.id,
                        elementCount: 0,
                        status: "QUEUED",
                        message:
                            "IFC file uploaded successfully. The file has been stored and queued for parsing. " +
                            "IFC parsing requires server-side processing to extract elements."
                    });
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
                workspaceId: resolvedWorkspaceId || undefined,
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
        let resolvedWorkspaceId = body.workspaceId || null;
        if (!resolvedWorkspaceId) {
            resolvedWorkspaceId = await getDefaultWorkspaceIdForUser(session.user.id);
        }
        const result = await ingestBimModel({
            modelId: body.modelId,
            modelName: body.modelName,
            workspaceId: resolvedWorkspaceId || undefined,
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
