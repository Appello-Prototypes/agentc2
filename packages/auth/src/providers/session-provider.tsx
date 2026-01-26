"use client";

import { useSession } from "../auth-client";
import { createContext, useContext } from "react";
import type { Session } from "../auth";

const SessionContext = createContext<{ session: Session | null }>({
    session: null
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();

    return <SessionContext.Provider value={{ session }}>{children}</SessionContext.Provider>;
}

export function useSessionContext() {
    return useContext(SessionContext);
}
