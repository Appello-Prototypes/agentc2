import { describe, test, expect } from "vitest";
import { buildGoogleAuthorizationUrl } from "../google-oauth";

describe("Google OAuth", () => {
    test("buildGoogleAuthorizationUrl includes include_granted_scopes parameter", () => {
        const url = buildGoogleAuthorizationUrl({
            clientId: "test-client-id",
            redirectUri: "http://localhost:3001/api/callback",
            state: "test-state",
            codeChallenge: "test-challenge"
        });

        const parsedUrl = new URL(url);

        // Verify include_granted_scopes is set to "true"
        expect(parsedUrl.searchParams.get("include_granted_scopes")).toBe("true");

        // Verify other required parameters are present
        expect(parsedUrl.searchParams.get("client_id")).toBe("test-client-id");
        expect(parsedUrl.searchParams.get("redirect_uri")).toBe(
            "http://localhost:3001/api/callback"
        );
        expect(parsedUrl.searchParams.get("state")).toBe("test-state");
        expect(parsedUrl.searchParams.get("code_challenge")).toBe("test-challenge");
        expect(parsedUrl.searchParams.get("access_type")).toBe("offline");
        expect(parsedUrl.searchParams.get("prompt")).toBe("consent");
    });

    test("buildGoogleAuthorizationUrl uses custom scopes when provided", () => {
        const customScopes = ["scope1", "scope2"];
        const url = buildGoogleAuthorizationUrl({
            clientId: "test-client-id",
            redirectUri: "http://localhost:3001/api/callback",
            state: "test-state",
            codeChallenge: "test-challenge",
            scopes: customScopes
        });

        const parsedUrl = new URL(url);
        expect(parsedUrl.searchParams.get("scope")).toBe("scope1 scope2");
    });

    test("buildGoogleAuthorizationUrl includes calendar.events scope by default", () => {
        const url = buildGoogleAuthorizationUrl({
            clientId: "test-client-id",
            redirectUri: "http://localhost:3001/api/callback",
            state: "test-state",
            codeChallenge: "test-challenge"
        });

        const parsedUrl = new URL(url);
        const scopes = parsedUrl.searchParams.get("scope") || "";

        // Verify calendar.events scope is included in default scopes
        expect(scopes).toContain("https://www.googleapis.com/auth/calendar.events");
    });
});
