import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AgentC2 Documentation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function DocsOpenGraphImage() {
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                background: "#050816",
                color: "#ffffff",
                padding: "64px"
            }}
        >
            <div style={{ fontSize: 26, opacity: 0.8 }}>AgentC2</div>
            <div style={{ fontSize: 66, fontWeight: 700, marginTop: 10 }}>Documentation</div>
            <div style={{ fontSize: 30, marginTop: 20, opacity: 0.9 }}>
                Excruciating detail for production AI operations
            </div>
        </div>,
        size
    );
}
