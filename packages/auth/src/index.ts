// Server-side auth
export { auth, onPostBootstrap, onAuthEvent } from "./auth";
export type { Session, User, AuthEvent, AuthEventType } from "./auth";

// Client-side auth
export { authClient, signIn, signUp, signOut, linkSocial, useSession } from "./auth-client";

// Bootstrap utility
export {
    bootstrapUserOrganization,
    createNewOrganizationForUser,
    getEmailDomain
} from "./bootstrap";
export type { BootstrapResult, BootstrapOptions } from "./bootstrap";

// Environment utilities
export { validateAuthEnv, getAppUrl } from "./env";
