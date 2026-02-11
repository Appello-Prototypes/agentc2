// Server-side auth
export { auth } from "./auth";
export type { Session, User } from "./auth";

// Client-side auth
export { authClient, signIn, signUp, signOut, linkSocial, useSession } from "./auth-client";

// Bootstrap utility
export {
    bootstrapUserOrganization,
    createNewOrganizationForUser,
    getEmailDomain
} from "./bootstrap";
export type { BootstrapResult } from "./bootstrap";

// Environment utilities
export { validateAuthEnv, getAppUrl } from "./env";
