"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface OrganizationInfo {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    role: string;
}

interface OrganizationContextValue {
    activeOrganization: OrganizationInfo | null;
    organizations: OrganizationInfo[];
    loading: boolean;
    switchOrganization: (orgId: string) => Promise<void>;
    switching: boolean;
}

const OrganizationContext = createContext<OrganizationContextValue>({
    activeOrganization: null,
    organizations: [],
    loading: true,
    switchOrganization: async () => {},
    switching: false
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
    const [activeOrganization, setActiveOrganization] = useState<OrganizationInfo | null>(null);
    const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [switching, setSwitching] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function fetchOrgs() {
            try {
                const res = await fetch("/api/organizations/switch");
                if (!res.ok) throw new Error("Failed to fetch organizations");
                const data = await res.json();
                if (!cancelled && data.success) {
                    setActiveOrganization(data.activeOrganization);
                    setOrganizations(data.organizations);
                }
            } catch {
                // Silently fail - user may not be authenticated yet
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchOrgs();

        const interval = setInterval(fetchOrgs, 60_000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const switchOrganization = useCallback(
        async (orgId: string) => {
            if (orgId === activeOrganization?.id) return;

            setSwitching(true);
            try {
                const res = await fetch("/api/organizations/switch", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ organizationId: orgId })
                });

                if (!res.ok) {
                    throw new Error("Failed to switch organization");
                }

                const data = await res.json();
                if (data.success) {
                    const switched = organizations.find((o) => o.id === orgId);
                    if (switched) {
                        setActiveOrganization(switched);
                    }
                    window.location.reload();
                }
            } catch (error) {
                console.error("Failed to switch organization:", error);
                setSwitching(false);
            }
        },
        [activeOrganization?.id, organizations]
    );

    return (
        <OrganizationContext.Provider
            value={{
                activeOrganization,
                organizations,
                loading,
                switchOrganization,
                switching
            }}
        >
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    return useContext(OrganizationContext);
}
