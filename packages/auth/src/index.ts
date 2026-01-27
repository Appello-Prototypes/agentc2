// Server-side auth
export { auth } from "./auth";
export type { Session, User } from "./auth";

// Client-side auth
export { authClient, signIn, signUp, signOut, useSession } from "./auth-client";

// Environment utilities
export { validateAuthEnv, getAppUrl } from "./env";
