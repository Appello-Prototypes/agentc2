"use client";

import { Suspense } from "react";
import { AppProvidersWrapper } from "@/components/AppProvidersWrapper";
import { EmbedWorkspaceHeader, EmbedBrandBar } from "@/components/EmbedWorkspaceHeader";
import { useEmbedConfig } from "@/hooks/useEmbedConfig";
import type { EmbedSessionConfig, EmbedBranding } from "@/lib/embed-deployment";

function BrandingStyle({ branding }: { branding?: EmbedBranding }) {
    if (!branding?.primaryColor && !branding?.accentColor) return null;

    const rules: string[] = [];
    if (branding.primaryColor) rules.push(`--primary: ${branding.primaryColor};`);
    if (branding.accentColor) rules.push(`--accent: ${branding.accentColor};`);

    if (rules.length === 0) return null;

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: `:root, .dark { ${rules.join(" ")} }`
            }}
        />
    );
}

function PoweredByBadge() {
    return (
        <div className="text-muted-foreground/40 py-1 text-center text-[10px]">
            Powered by{" "}
            <a
                href="https://agentc2.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
            >
                AgentC2
            </a>
        </div>
    );
}

function EmbedWorkspaceShellInner({
    config,
    children
}: {
    config: EmbedSessionConfig;
    children: React.ReactNode;
}) {
    return (
        <>
            <BrandingStyle branding={config.branding} />
            <div className="flex h-full flex-col">
                {config.mode === "workspace" ? (
                    <EmbedWorkspaceHeader config={config} />
                ) : (
                    <EmbedBrandBar config={config} />
                )}
                <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
                {config.branding?.showPoweredBy !== false && <PoweredByBadge />}
            </div>
        </>
    );
}

export function EmbedWorkspaceShell({ children }: { children: React.ReactNode }) {
    const config = useEmbedConfig();

    if (!config) {
        return <>{children}</>;
    }

    return (
        <Suspense fallback={null}>
            <AppProvidersWrapper>
                <EmbedWorkspaceShellInner config={config}>{children}</EmbedWorkspaceShellInner>
            </AppProvidersWrapper>
        </Suspense>
    );
}
