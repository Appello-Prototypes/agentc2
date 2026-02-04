"use client";

import type { SVGProps } from "react";

interface AgentC2LogoProps extends SVGProps<SVGSVGElement> {
    size?: number;
}

/**
 * AgentC2 Logo - App icon featuring "C2" as the central element
 * Used in the header and branding throughout the app
 */
export function AgentC2Logo({ size = 24, className, ...props }: AgentC2LogoProps) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            {/* Background rounded square */}
            <rect x="2" y="2" width="28" height="28" rx="7" className="fill-foreground" />
            {/* C2 text */}
            <text
                x="16"
                y="21.5"
                textAnchor="middle"
                className="fill-background"
                style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    fontFamily:
                        "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                    letterSpacing: "-0.5px"
                }}
            >
                C2
            </text>
        </svg>
    );
}
