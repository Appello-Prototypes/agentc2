"use client";

import { useSession } from "@/lib/auth-client";
import { createContext, useContext } from "react";

const SessionContext = createContext<{ session: any | null }>({
    session: null
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();

    return <SessionContext.Provider value={{ session }}>{children}</SessionContext.Provider>;
}

export function useSessionContext() {
    return useContext(SessionContext);
}
