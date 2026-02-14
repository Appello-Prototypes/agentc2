"use client";

import { useMemo } from "react";
import type { VoiceState } from "@/hooks/useVoiceConversation";

/** Pre-computed bar heights for the speaking visualization */
const SPEAKING_BAR_HEIGHTS = [16, 24, 32, 28, 32, 24, 16] as const;

function SpeakingBars() {
    return (
        <div className="flex items-center gap-[3px]">
            {SPEAKING_BAR_HEIGHTS.map((h, i) => (
                <div
                    key={i}
                    className="animate-pulse rounded-full bg-white/80"
                    style={{
                        width: 2.5,
                        height: h,
                        animationDelay: `${i * 100}ms`,
                        animationDuration: "0.8s"
                    }}
                />
            ))}
        </div>
    );
}

interface VoiceOrbProps {
    state: VoiceState;
    audioLevel: number;
    onClick: () => void;
    size?: number;
}

/**
 * Siri-inspired animated voice orb.
 *
 * States:
 *   idle       – soft breathing pulse, blue/purple gradient
 *   listening  – reactive to mic input, cyan/green glow
 *   processing – spinning ring, purple/indigo
 *   speaking   – pulsing with audio output, warm blue/white
 */
export function VoiceOrb({ state, audioLevel, onClick, size = 200 }: VoiceOrbProps) {
    // Scale the orb based on audio level when listening
    const dynamicScale = useMemo(() => {
        if (state === "listening") {
            return 1 + audioLevel * 0.3;
        }
        if (state === "speaking") {
            return 1 + audioLevel * 0.15;
        }
        return 1;
    }, [state, audioLevel]);

    // Dynamic glow size based on audio
    const glowSpread = useMemo(() => {
        if (state === "listening") {
            return 40 + audioLevel * 60;
        }
        if (state === "speaking") {
            return 30 + audioLevel * 40;
        }
        return 20;
    }, [state, audioLevel]);

    return (
        <button
            onClick={onClick}
            className="relative cursor-pointer outline-none select-none focus:outline-none"
            style={{ width: size, height: size }}
            aria-label={
                state === "idle"
                    ? "Tap to speak"
                    : state === "listening"
                      ? "Listening... tap to cancel"
                      : state === "processing"
                        ? "Processing..."
                        : "Speaking..."
            }
        >
            {/* Outer glow ring */}
            <div
                className="absolute inset-0 rounded-full transition-all duration-500"
                style={{
                    boxShadow:
                        state === "idle"
                            ? `0 0 ${glowSpread}px rgba(99, 102, 241, 0.3), 0 0 ${glowSpread * 2}px rgba(139, 92, 246, 0.15)`
                            : state === "listening"
                              ? `0 0 ${glowSpread}px rgba(6, 182, 212, 0.5), 0 0 ${glowSpread * 2}px rgba(34, 211, 238, 0.25)`
                              : state === "processing"
                                ? `0 0 ${glowSpread}px rgba(139, 92, 246, 0.5), 0 0 ${glowSpread * 2}px rgba(168, 85, 247, 0.25)`
                                : `0 0 ${glowSpread}px rgba(59, 130, 246, 0.5), 0 0 ${glowSpread * 2}px rgba(96, 165, 250, 0.25)`,
                    transform: `scale(${dynamicScale})`,
                    transition: state === "listening" ? "transform 50ms ease-out" : undefined
                }}
            />

            {/* Spinning ring (processing state) */}
            {state === "processing" && (
                <div className="absolute inset-[-4px]">
                    <svg
                        viewBox="0 0 100 100"
                        className="h-full w-full animate-spin"
                        style={{ animationDuration: "2s" }}
                    >
                        <defs>
                            <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="rgba(139, 92, 246, 0.8)" />
                                <stop offset="50%" stopColor="rgba(59, 130, 246, 0.4)" />
                                <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
                            </linearGradient>
                        </defs>
                        <circle
                            cx="50"
                            cy="50"
                            r="48"
                            fill="none"
                            stroke="url(#ring-gradient)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeDasharray="200 100"
                        />
                    </svg>
                </div>
            )}

            {/* Ambient ripple (listening) */}
            {state === "listening" && (
                <>
                    <div
                        className="absolute inset-0 animate-ping rounded-full bg-cyan-400/10"
                        style={{ animationDuration: "2s" }}
                    />
                    <div
                        className="absolute inset-[-10px] animate-ping rounded-full bg-cyan-400/5"
                        style={{ animationDuration: "3s" }}
                    />
                </>
            )}

            {/* Speaking ripple */}
            {state === "speaking" && (
                <div
                    className="absolute inset-0 animate-ping rounded-full bg-blue-400/10"
                    style={{ animationDuration: "1.5s" }}
                />
            )}

            {/* Main orb */}
            <div
                className="absolute inset-0 overflow-hidden rounded-full transition-all duration-700"
                style={{
                    transform: `scale(${dynamicScale})`,
                    transition:
                        state === "listening"
                            ? "transform 80ms ease-out, background 700ms"
                            : "transform 700ms ease-in-out, background 700ms"
                }}
            >
                {/* Gradient background */}
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background:
                            state === "idle"
                                ? "radial-gradient(circle at 40% 35%, rgba(129, 140, 248, 0.6), rgba(99, 102, 241, 0.4) 40%, rgba(79, 70, 229, 0.3) 70%, rgba(55, 48, 163, 0.2))"
                                : state === "listening"
                                  ? "radial-gradient(circle at 40% 35%, rgba(34, 211, 238, 0.7), rgba(6, 182, 212, 0.5) 40%, rgba(8, 145, 178, 0.3) 70%, rgba(21, 94, 117, 0.2))"
                                  : state === "processing"
                                    ? "radial-gradient(circle at 40% 35%, rgba(168, 85, 247, 0.6), rgba(139, 92, 246, 0.4) 40%, rgba(124, 58, 237, 0.3) 70%, rgba(91, 33, 182, 0.2))"
                                    : "radial-gradient(circle at 40% 35%, rgba(96, 165, 250, 0.7), rgba(59, 130, 246, 0.5) 40%, rgba(37, 99, 235, 0.3) 70%, rgba(29, 78, 216, 0.2))"
                    }}
                />

                {/* Glass layer */}
                <div
                    className="absolute inset-0 rounded-full"
                    style={{
                        background:
                            "radial-gradient(circle at 35% 25%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.08) 30%, transparent 60%)",
                        backdropFilter: "blur(20px)"
                    }}
                />

                {/* Inner glow */}
                <div
                    className="absolute inset-[15%] rounded-full transition-opacity duration-500"
                    style={{
                        background:
                            state === "idle"
                                ? "radial-gradient(circle, rgba(165, 180, 252, 0.3), transparent)"
                                : state === "listening"
                                  ? "radial-gradient(circle, rgba(103, 232, 249, 0.4), transparent)"
                                  : state === "processing"
                                    ? "radial-gradient(circle, rgba(196, 181, 253, 0.4), transparent)"
                                    : "radial-gradient(circle, rgba(147, 197, 253, 0.4), transparent)",
                        opacity: state === "listening" ? 0.6 + audioLevel * 0.4 : 0.7
                    }}
                />

                {/* Idle breathing animation */}
                {state === "idle" && (
                    <div
                        className="absolute inset-[10%] animate-pulse rounded-full"
                        style={{
                            background:
                                "radial-gradient(circle, rgba(129, 140, 248, 0.15), transparent)",
                            animationDuration: "3s"
                        }}
                    />
                )}
            </div>

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
                {state === "idle" && (
                    <svg
                        width={size * 0.2}
                        height={size * 0.2}
                        viewBox="0 0 24 24"
                        fill="none"
                        className="text-white/80 drop-shadow-lg"
                    >
                        <path
                            d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
                            fill="currentColor"
                        />
                        <path
                            d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11z"
                            fill="currentColor"
                        />
                    </svg>
                )}

                {state === "listening" && (
                    <div className="flex items-center gap-[3px]">
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={i}
                                className="rounded-full bg-white/90"
                                style={{
                                    width: 3,
                                    height: Math.max(
                                        8,
                                        (audioLevel * size * 0.3 + 8) *
                                            (i === 2 ? 1 : i === 1 || i === 3 ? 0.7 : 0.4)
                                    ),
                                    transition: "height 80ms ease-out"
                                }}
                            />
                        ))}
                    </div>
                )}

                {state === "processing" && (
                    <div className="flex items-center gap-1.5">
                        {[...Array(3)].map((_, i) => (
                            <div
                                key={i}
                                className="h-2 w-2 animate-bounce rounded-full bg-white/80"
                                style={{ animationDelay: `${i * 150}ms` }}
                            />
                        ))}
                    </div>
                )}

                {state === "speaking" && <SpeakingBars />}
            </div>
        </button>
    );
}
