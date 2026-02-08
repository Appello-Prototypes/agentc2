// Server-side auth
export { auth } from "./auth";
export type { Session, User } from "./auth";

// Client-side auth
export { authClient, signIn, signUp, signOut, linkSocial, useSession } from "./auth-client";

// Environment utilities
export { validateAuthEnv, getAppUrl } from "./env";
