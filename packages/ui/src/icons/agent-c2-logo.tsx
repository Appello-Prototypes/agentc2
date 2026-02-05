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
            {/* Border rounded square - pinstripe style */}
            <rect
                x="3"
                y="3"
                width="26"
                height="26"
                rx="6"
                fill="none"
                className="stroke-foreground"
                strokeWidth="2"
            />
            {/* C2 text */}
            <text
                x="16"
                y="22"
                textAnchor="middle"
                className="fill-foreground"
                style={{
                    fontSize: "17px",
                    fontWeight: 800,
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
