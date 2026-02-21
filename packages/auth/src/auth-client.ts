"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

const baseURL =
    typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const authClient = createAuthClient({
    baseURL,
    plugins: [twoFactorClient()]
});

export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
export const signOut = authClient.signOut;
export const linkSocial = authClient.linkSocial;
export const useSession = authClient.useSession;
export const twoFactor = authClient.twoFactor;
