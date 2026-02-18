import { ImageResponse } from "next/og";
import { getBlogPost } from "@/lib/content/blog";

export const runtime = "edge";
export const alt = "AgentC2 Blog Post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgProps {
    params: Promise<{ slug: string }>;
}

export default async function BlogDetailOpenGraphImage({ params }: OgProps) {
    const { slug } = await params;
    const post = getBlogPost(slug);
    const title = post?.title ?? "AgentC2 Blog";

    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                background: "#111827",
                color: "#ffffff",
                padding: "64px"
            }}
        >
            <div style={{ fontSize: 24, opacity: 0.8 }}>AgentC2 Blog</div>
            <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.1, marginTop: 10 }}>
                {title}
            </div>
            <div style={{ fontSize: 24, marginTop: 20, opacity: 0.9 }}>
                AI agent orchestration insights
            </div>
        </div>,
        size
    );
}
