/**
 * Layout for live agent routes.
 * These pages just redirect to workspace, so we use a simple passthrough layout.
 */
export default function LiveAgentLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
