import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

export interface SpacesConfig {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
}

function getSpacesConfig(): SpacesConfig {
    const endpoint = process.env.SPACES_ENDPOINT;
    const region = process.env.SPACES_REGION || "us-east-1";
    const accessKeyId = process.env.SPACES_ACCESS_KEY_ID;
    const secretAccessKey = process.env.SPACES_SECRET_ACCESS_KEY;
    const bucket = process.env.SPACES_BUCKET;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
        throw new Error(
            "Spaces configuration missing. Set SPACES_ENDPOINT, SPACES_ACCESS_KEY_ID, SPACES_SECRET_ACCESS_KEY, and SPACES_BUCKET."
        );
    }

    return {
        endpoint,
        region,
        accessKeyId,
        secretAccessKey,
        bucket
    };
}

let cachedClient: S3Client | null = null;

function getSpacesClient(): S3Client {
    if (cachedClient) {
        return cachedClient;
    }

    const config = getSpacesConfig();
    cachedClient = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey
        }
    });

    return cachedClient;
}

export async function uploadBimObject(params: {
    key: string;
    body: Buffer;
    contentType?: string;
}): Promise<{ key: string; bucket: string; etag?: string }> {
    const client = getSpacesClient();
    const config = getSpacesConfig();

    const result = await client.send(
        new PutObjectCommand({
            Bucket: config.bucket,
            Key: params.key,
            Body: params.body,
            ContentType: params.contentType
        })
    );

    return {
        key: params.key,
        bucket: config.bucket,
        etag: result.ETag
    };
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export async function getBimObjectBuffer(params: { key: string }): Promise<Buffer> {
    const client = getSpacesClient();
    const config = getSpacesConfig();

    const result = await client.send(
        new GetObjectCommand({
            Bucket: config.bucket,
            Key: params.key
        })
    );

    if (!result.Body) {
        throw new Error("Spaces object body was empty.");
    }

    return streamToBuffer(result.Body as Readable);
}

export async function headBimObject(params: { key: string }) {
    const client = getSpacesClient();
    const config = getSpacesConfig();

    return client.send(
        new HeadObjectCommand({
            Bucket: config.bucket,
            Key: params.key
        })
    );
}
