type NextRequest = Request;

/**
 * Create a mock NextRequest for testing API routes
 */
export function createMockRequest(
    url: string,
    options: {
        method?: string;
        body?: unknown;
        headers?: Record<string, string>;
        searchParams?: Record<string, string>;
    } = {}
): NextRequest {
    const { method = "GET", body, headers = {}, searchParams = {} } = options;

    // Build URL with search params
    const urlObj = new URL(url, "http://localhost:3001");
    Object.entries(searchParams).forEach(([key, value]) => {
        urlObj.searchParams.set(key, value);
    });

    const requestInit: RequestInit = {
        method,
        headers: {
            "Content-Type": "application/json",
            ...headers
        }
    };

    if (body && method !== "GET") {
        requestInit.body = JSON.stringify(body);
    }

    return new Request(urlObj, requestInit) as NextRequest;
}

/**
 * Create mock route params (for dynamic routes like [id])
 */
export function createMockParams(params: Record<string, string>): Promise<Record<string, string>> {
    return Promise.resolve(params);
}

/**
 * Parse JSON response from NextResponse
 */
export async function parseResponse<T = unknown>(
    response: Response
): Promise<{ status: number; data: T }> {
    const data = (await response.json()) as T;
    return {
        status: response.status,
        data
    };
}

/**
 * Assert successful API response
 */
export function assertSuccess(response: { status: number; data: { success?: boolean } }) {
    if (response.status !== 200 || !response.data.success) {
        throw new Error(
            `Expected success response, got status ${response.status}: ${JSON.stringify(response.data)}`
        );
    }
}

/**
 * Assert error API response
 */
export function assertError(
    response: { status: number; data: { error?: string } },
    expectedStatus: number
) {
    if (response.status !== expectedStatus) {
        throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
    }
}

/**
 * Create a mock session for authenticated requests
 */
export function createMockSession(userId: string = "test-user-id") {
    return {
        user: {
            id: userId,
            email: "test@example.com",
            name: "Test User"
        },
        session: {
            id: "test-session-id",
            userId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    };
}
