import { describe, it, expect } from "bun:test"
import { validateRouteParam, validateRouteParams } from "../src/validate-params"

describe("validateRouteParam", () => {
    it("should accept valid CUID", () => {
        const validCuid = "clx1234567890abcdefghijkl"
        const result = validateRouteParam("userId", validCuid)

        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(result.value).toBe(validCuid)
        }
    })

    it("should reject null value", () => {
        const result = validateRouteParam("userId", null)

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it("should reject undefined value", () => {
        const result = validateRouteParam("userId", undefined)

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it("should reject empty string", () => {
        const result = validateRouteParam("userId", "")

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it('should reject string "null"', () => {
        const result = validateRouteParam("userId", "null")

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it('should reject string "undefined"', () => {
        const result = validateRouteParam("userId", "undefined")

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it("should reject invalid CUID format (too short)", () => {
        const result = validateRouteParam("userId", "abc123")

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it("should reject invalid CUID format (too long)", () => {
        const result = validateRouteParam("userId", "clx1234567890abcdefghijk123")

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it("should reject invalid CUID format (special characters)", () => {
        const result = validateRouteParam("userId", "clx123456789@abcdefghij")

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it("should include parameter name in error message", async () => {
        const result = validateRouteParam("customId", null)

        expect(result.valid).toBe(false)
        if (!result.valid) {
            const body = await result.response.json()
            expect(body.error).toContain("customId")
        }
    })
})

describe("validateRouteParams", () => {
    it("should validate multiple valid parameters", () => {
        const result = validateRouteParams({
            userId: "clx1234567890abcdefghijkl",
            orgId: "clx9876543210zyxwvutsrqpo"
        })

        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(result.values.userId).toBe("clx1234567890abcdefghijkl")
            expect(result.values.orgId).toBe("clx9876543210zyxwvutsrqpo")
        }
    })

    it("should fail if any parameter is invalid", () => {
        const result = validateRouteParams({
            userId: "clx1234567890abcdefghijk",
            orgId: null
        })

        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.response.status).toBe(400)
        }
    })

    it("should fail on first invalid parameter", async () => {
        const result = validateRouteParams({
            userId: null,
            orgId: "invalid"
        })

        expect(result.valid).toBe(false)
        if (!result.valid) {
            const body = await result.response.json()
            expect(body.error).toContain("userId")
        }
    })
})
