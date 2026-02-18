import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AgentC2";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                background: "#0a0a0a",
                color: "#ffffff",
                padding: "64px"
            }}
        >
            <div style={{ fontSize: 28, opacity: 0.8 }}>AgentC2</div>
            <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, marginTop: 12 }}>
                AI Agent Orchestration Platform
            </div>
            <div style={{ fontSize: 28, marginTop: 24, opacity: 0.9 }}>
                Workflows · MCP Integrations · Guardrails · Observability
            </div>
        </div>,
        size
    );
}
