import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveGolfNowCredentials } from "./golf-credentials";

const GOLFNOW_PRODUCTION_URL = "https://api.gnsvc.com";
const GOLFNOW_SANDBOX_URL = "https://sandbox.api.gnsvc.com";
const FETCH_TIMEOUT_MS = 20_000;

function getBaseUrl(useSandbox: boolean): string {
    return useSandbox ? GOLFNOW_SANDBOX_URL : GOLFNOW_PRODUCTION_URL;
}

export const golfnowBookTool = createTool({
    id: "golfnow-book",
    description:
        "Book a tee time on GolfNow. Use AFTER golfnow-search to get the teeTimeRateId. " +
        "ALWAYS confirm with the user before calling this tool. " +
        "Follows GolfNow's reservation workflow: authenticate customer, generate invoice, " +
        "then claim the reservation. Requires GOLFNOW_USERNAME and GOLFNOW_PASSWORD.",
    inputSchema: z.object({
        facilityId: z.string().describe("GolfNow facility ID from golfnow-search results"),
        teeTimeRateId: z.string().describe("Tee time rate ID from golfnow-search results"),
        customerEmail: z.string().describe("Customer email address for GolfNow account"),
        customerFirstName: z.string().describe("Customer first name"),
        customerLastName: z.string().describe("Customer last name"),
        players: z.number().min(1).max(4).describe("Number of players")
    }),
    outputSchema: z.object({
        success: z.boolean(),
        platform: z.literal("golfnow"),
        confirmationNumber: z.string().optional(),
        courseName: z.string().optional(),
        date: z.string().optional(),
        time: z.string().optional(),
        players: z.number().optional(),
        totalPrice: z.string().optional(),
        reservationId: z.string().optional(),
        error: z.string().optional(),
        apiKeyMissing: z.boolean().optional()
    }),
    execute: async ({
        facilityId,
        teeTimeRateId,
        customerEmail,
        customerFirstName,
        customerLastName,
        players
    }) => {
        const config = await resolveGolfNowCredentials();
        if (!config) {
            return {
                success: false,
                platform: "golfnow" as const,
                error:
                    "GolfNow API credentials not configured. " +
                    "Add your credentials via Settings > Integrations > GolfNow, " +
                    "or set GOLFNOW_USERNAME and GOLFNOW_PASSWORD in environment variables.",
                apiKeyMissing: true
            };
        }

        const baseUrl = getBaseUrl(config.useSandbox);
        const authHeaders = {
            "Content-Type": "application/json; charset=utf-8",
            UserName: config.username,
            Password: config.password,
            AdvancedErrorCodes: "True"
        };

        try {
            // Step 1: Authenticate customer (or create)
            const customerAuthUrl = `${baseUrl}/rest/customers/${encodeURIComponent(customerEmail)}`;
            const customerResponse = await fetch(customerAuthUrl, {
                method: "GET",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: authHeaders
            });

            let customerId = customerEmail;
            if (customerResponse.ok) {
                const customerData = await customerResponse.json();
                customerId = customerData?.CustomerToken || customerEmail;
            }

            // Step 2: Generate invoice for the tee time rate
            const invoiceUrl = `${baseUrl}/rest/customers/${encodeURIComponent(customerEmail)}/invoices`;
            const invoiceBody = {
                TeeTimeRateID: Number(teeTimeRateId),
                Players: players,
                Customer: {
                    Email: customerEmail,
                    FirstName: customerFirstName,
                    LastName: customerLastName
                }
            };

            const invoiceResponse = await fetch(invoiceUrl, {
                method: "POST",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: authHeaders,
                body: JSON.stringify(invoiceBody)
            });

            if (!invoiceResponse.ok) {
                const errorText = await invoiceResponse.text();
                if (invoiceResponse.status === 409) {
                    return {
                        success: false,
                        platform: "golfnow" as const,
                        error: "This tee time is no longer available."
                    };
                }
                return {
                    success: false,
                    platform: "golfnow" as const,
                    error: `GolfNow invoice generation failed (HTTP ${invoiceResponse.status}): ${errorText.substring(0, 200)}`
                };
            }

            const invoiceData = await invoiceResponse.json();
            const invoiceId = invoiceData?.InvoiceID || invoiceData?.Id;

            if (!invoiceId) {
                return {
                    success: false,
                    platform: "golfnow" as const,
                    error: "GolfNow invoice was created but no invoice ID was returned."
                };
            }

            // Step 3: Claim the reservation
            const reservationUrl = `${baseUrl}/rest/customers/${encodeURIComponent(customerEmail)}/reservations`;
            const reservationBody = {
                InvoiceID: invoiceId,
                PaymentType: "AffiliatePayment"
            };

            const reservationResponse = await fetch(reservationUrl, {
                method: "POST",
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: authHeaders,
                body: JSON.stringify(reservationBody)
            });

            if (!reservationResponse.ok) {
                const errorText = await reservationResponse.text();
                return {
                    success: false,
                    platform: "golfnow" as const,
                    error: `GolfNow reservation claim failed (HTTP ${reservationResponse.status}): ${errorText.substring(0, 200)}`
                };
            }

            const reservationData = await reservationResponse.json();

            return {
                success: true,
                platform: "golfnow" as const,
                confirmationNumber:
                    reservationData.ConfirmationNumber ||
                    reservationData.ReservationID ||
                    String(invoiceId),
                courseName: reservationData.FacilityName,
                date: reservationData.Date,
                time: reservationData.Time,
                players: reservationData.Players || players,
                totalPrice:
                    reservationData.TotalPrice != null
                        ? `$${Number(reservationData.TotalPrice).toFixed(2)}`
                        : invoiceData.TotalPrice != null
                          ? `$${Number(invoiceData.TotalPrice).toFixed(2)}`
                          : undefined,
                reservationId: String(reservationData.ReservationID || invoiceId)
            };
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes("TimeoutError") || msg.includes("aborted")) {
                return {
                    success: false,
                    platform: "golfnow" as const,
                    error: "GolfNow API did not respond within 20 seconds."
                };
            }
            return {
                success: false,
                platform: "golfnow" as const,
                error: `GolfNow booking failed: ${msg}`
            };
        }
    }
});
