import { NextResponse } from "next/server";

/**
 * Validates that a route parameter is a non-empty string with valid CUID format.
 * Returns 400 Bad Request if validation fails.
 *
 * @param paramName - The name of the parameter (for error messages)
 * @param paramValue - The parameter value to validate
 * @returns Either { valid: true, value: string } or { valid: false, response: NextResponse }
 */
export function validateRouteParam(
    paramName: string,
    paramValue: string | undefined | null
): { valid: true; value: string } | { valid: false; response: NextResponse } {
    if (
        !paramValue ||
        paramValue.trim() === "" ||
        paramValue === "null" ||
        paramValue === "undefined"
    ) {
        return {
            valid: false,
            response: NextResponse.json(
                { error: `Invalid ${paramName}: must be a valid ID` },
                { status: 400 }
            )
        };
    }

    // Validate CUID format (25 characters, alphanumeric)
    if (!/^[a-z0-9]{25}$/i.test(paramValue)) {
        return {
            valid: false,
            response: NextResponse.json(
                { error: `Invalid ${paramName}: must be a valid CUID` },
                { status: 400 }
            )
        };
    }

    return { valid: true, value: paramValue };
}

/**
 * Convenience wrapper for validating multiple route parameters.
 *
 * @param params - Object mapping parameter names to values
 * @returns Either { valid: true, values: Record<string, string> } or { valid: false, response: NextResponse }
 */
export function validateRouteParams(
    params: Record<string, string | undefined | null>
): { valid: true; values: Record<string, string> } | { valid: false; response: NextResponse } {
    const validated: Record<string, string> = {};

    for (const [name, value] of Object.entries(params)) {
        const result = validateRouteParam(name, value);
        if (!result.valid) {
            return { valid: false, response: result.response };
        }
        validated[name] = result.value;
    }

    return { valid: true, values: validated };
}
