import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AgentC2 Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function BlogOpenGraphImage() {
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
            <div style={{ fontSize: 24, opacity: 0.8 }}>AgentC2</div>
            <div style={{ fontSize: 66, fontWeight: 700, marginTop: 8 }}>Blog</div>
            <div style={{ fontSize: 28, marginTop: 20, opacity: 0.9 }}>
                Strategy, implementation, and production lessons
            </div>
        </div>,
        size
    );
}
