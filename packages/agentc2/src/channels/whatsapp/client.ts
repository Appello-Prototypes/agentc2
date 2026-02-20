/**
 * WhatsApp Client - WhatsApp Web integration via Baileys
 *
 * Uses @whiskeysockets/baileys to connect to WhatsApp Web.
 * Requires QR code pairing via WhatsApp Linked Devices.
 */

import type {
    ChannelHandler,
    ChannelStatus,
    WhatsAppConfig,
    OutgoingMessage,
    SendResult,
    MessageHandler,
    IncomingMessage
} from "../types";

/**
 * WhatsApp client using Baileys
 */
export class WhatsAppClient implements ChannelHandler {
    readonly type = "whatsapp" as const;
    private _status: ChannelStatus = "disconnected";
    private config: WhatsAppConfig;
    private messageHandler: MessageHandler | null = null;
    private socket: unknown = null;
    private qrCode: string | null = null;

    constructor(config: WhatsAppConfig) {
        this.config = config;
    }

    get status(): ChannelStatus {
        return this._status;
    }

    /**
     * Initialize WhatsApp connection
     */
    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            console.log("[WhatsApp] Channel disabled, skipping initialization");
            return;
        }

        this._status = "connecting";
        console.log("[WhatsApp] Initializing connection...");

        try {
            // Dynamic import of Baileys (optional dependency)
            const {
                default: makeWASocket,
                useMultiFileAuthState,
                DisconnectReason
            } = await import("@whiskeysockets/baileys");

            const sessionPath = this.config.sessionPath || "./.whatsapp-session";

            // Load or create auth state
            const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

            // Create socket
            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: true
            });

            const sock = this.socket as ReturnType<typeof makeWASocket>;

            // Handle connection updates
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    this.qrCode = qr;
                    console.log("[WhatsApp] QR code generated - scan with WhatsApp");
                }

                if (connection === "close") {
                    const statusCode = (
                        lastDisconnect?.error as { output?: { statusCode?: number } }
                    )?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    console.log(
                        `[WhatsApp] Connection closed. Reason: ${statusCode}. Reconnecting: ${shouldReconnect}`
                    );

                    this._status = "disconnected";

                    if (shouldReconnect) {
                        // Reconnect after a delay
                        setTimeout(() => this.initialize(), 5000);
                    }
                } else if (connection === "open") {
                    this._status = "connected";
                    this.qrCode = null;
                    console.log("[WhatsApp] Connected successfully");
                }
            });

            // Handle credential updates
            sock.ev.on("creds.update", saveCreds);

            // Handle incoming messages
            sock.ev.on("messages.upsert", async (m) => {
                if (!this.messageHandler) return;

                for (const msg of m.messages) {
                    // Skip status messages and own messages
                    if (msg.key.remoteJid === "status@broadcast") continue;
                    if (msg.key.fromMe) continue;

                    // Check allowlist
                    if (this.config.allowlist && this.config.allowlist.length > 0) {
                        const senderNumber =
                            msg.key.remoteJid?.replace("@s.whatsapp.net", "") || "";
                        const isAllowed = this.config.allowlist.some((num) =>
                            senderNumber.includes(num.replace(/[^0-9]/g, ""))
                        );
                        if (!isAllowed) {
                            console.log(
                                `[WhatsApp] Message from ${senderNumber} not in allowlist, ignoring`
                            );
                            continue;
                        }
                    }

                    const incomingMessage = this.parseMessage(msg);
                    if (incomingMessage) {
                        try {
                            // Import agent resolver dynamically to avoid circular deps
                            const { agentResolver } = await import("../../agents/resolver");
                            const { agent } = await agentResolver.resolve({
                                slug: this.config.defaultAgentSlug
                            });

                            const response = await this.messageHandler(incomingMessage, agent);

                            // Send response
                            await this.send({
                                channel: "whatsapp",
                                to: incomingMessage.from,
                                text: response,
                                replyToMessageId: incomingMessage.messageId
                            });
                        } catch (error) {
                            console.error("[WhatsApp] Error handling message:", error);
                        }
                    }
                }
            });

            this._status = "connecting";
        } catch (error) {
            console.error("[WhatsApp] Failed to initialize:", error);
            this._status = "error";
            throw error;
        }
    }

    /**
     * Parse Baileys message to IncomingMessage
     */
    private parseMessage(msg: unknown): IncomingMessage | null {
        try {
            const message = msg as {
                key: { remoteJid?: string; id?: string; participant?: string };
                message?: { conversation?: string; extendedTextMessage?: { text?: string } };
                messageTimestamp?: number;
            };

            const text =
                message.message?.conversation || message.message?.extendedTextMessage?.text || "";

            if (!text) return null;

            const remoteJid = message.key.remoteJid || "";
            const isGroup = remoteJid.endsWith("@g.us");
            const from = isGroup
                ? message.key.participant?.replace("@s.whatsapp.net", "") || ""
                : remoteJid.replace("@s.whatsapp.net", "");

            return {
                messageId: message.key.id || "",
                channel: "whatsapp",
                from: `+${from}`,
                to: "", // Bot's number
                text,
                timestamp: new Date((message.messageTimestamp || 0) * 1000),
                isGroup,
                groupId: isGroup ? remoteJid : undefined,
                raw: msg
            };
        } catch {
            return null;
        }
    }

    /**
     * Shutdown WhatsApp connection
     */
    async shutdown(): Promise<void> {
        console.log("[WhatsApp] Shutting down...");
        if (this.socket) {
            const sock = this.socket as { end: () => void };
            sock.end();
        }
        this._status = "disconnected";
    }

    /**
     * Send a message via WhatsApp
     */
    async send(message: OutgoingMessage): Promise<SendResult> {
        if (this._status !== "connected" || !this.socket) {
            return {
                success: false,
                error: "WhatsApp not connected"
            };
        }

        try {
            const sock = this.socket as {
                sendMessage: (
                    jid: string,
                    content: { text: string },
                    options?: { quoted?: { key: { id: string } } }
                ) => Promise<{ key: { id: string } }>;
            };

            // Format phone number to JID
            const jid = message.to.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

            const options = message.replyToMessageId
                ? { quoted: { key: { id: message.replyToMessageId } } }
                : undefined;

            const result = await sock.sendMessage(jid, { text: message.text }, options);

            return {
                success: true,
                messageId: result.key.id,
                timestamp: new Date()
            };
        } catch (error) {
            console.error("[WhatsApp] Failed to send message:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    /**
     * Get current connection status
     */
    getStatus(): ChannelStatus {
        return this._status;
    }

    /**
     * Get QR code for pairing (if available)
     */
    getQRCode(): string | null {
        return this.qrCode;
    }

    /**
     * Set message handler
     */
    onMessage(handler: MessageHandler): void {
        this.messageHandler = handler;
    }
}
