import { createServer } from "http";
import { WebSocketServer, WebSocket, type RawData } from "ws";

const PORT = Number(process.env.VOICE_STREAM_PORT || "3002");
const PATH = process.env.VOICE_STREAM_PATH || "/voice/stream";
const AUTH_TOKEN = process.env.VOICE_STREAM_AUTH_TOKEN || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";

const TWILIO_SAMPLE_RATE = 8000;
const DEFAULT_ELEVEN_INPUT_RATE = Number(process.env.VOICE_ELEVENLABS_INPUT_SAMPLE_RATE || "16000");
const MAX_PENDING_CHUNKS = Number(process.env.VOICE_STREAM_MAX_PENDING_CHUNKS || "5");

type TwilioStartMessage = {
    event: "start";
    start: {
        streamSid: string;
        callSid: string;
        tracks?: string[];
        customParameters?: Record<string, string>;
        mediaFormat?: {
            encoding: string;
            sampleRate: number;
            channels: number;
        };
    };
};

type TwilioMediaMessage = {
    event: "media";
    streamSid: string;
    media: {
        track?: string;
        payload: string;
    };
};

type TwilioStopMessage = {
    event: "stop";
    streamSid: string;
    stop: {
        callSid: string;
    };
};

type TwilioMessage =
    | TwilioStartMessage
    | TwilioMediaMessage
    | TwilioStopMessage
    | { event: "connected" }
    | { event: "dtmf" }
    | { event: "mark" };

type ElevenLabsServerEvent =
    | {
          type: "conversation_initiation_metadata";
          conversation_initiation_metadata_event: {
              conversation_id: string;
              agent_output_audio_format: string;
          };
      }
    | {
          type: "audio";
          audio_event: {
              audio_base_64: string;
              event_id: number;
          };
      }
    | { type: "interruption" }
    | { type: "ping"; ping_event: { event_id: number; ping_ms?: number } };

type LatencyMarkers = {
    streamStartedAt?: number;
    firstInboundAudioAt?: number;
    elevenlabsConnectedAt?: number;
    firstElevenlabsAudioAt?: number;
    firstTwilioAudioOutAt?: number;
    streamEndedAt?: number;
};

class VoiceBridgeSession {
    private twilioWs: WebSocket;
    private elevenWs: WebSocket | null = null;
    private streamSid = "";
    private callSid = "";
    private agentId = "";
    private conversationId = "";
    private elevenInputSampleRate = DEFAULT_ELEVEN_INPUT_RATE;
    private elevenOutputSampleRate = DEFAULT_ELEVEN_INPUT_RATE;
    private pendingAudioChunks: string[] = [];
    private markers: LatencyMarkers = {};
    private isShuttingDown = false;

    constructor(twilioWs: WebSocket) {
        this.twilioWs = twilioWs;
        this.enableLowLatencySocket(this.twilioWs);
    }

    async handleTwilioMessage(raw: string) {
        let message: TwilioMessage;
        try {
            message = JSON.parse(raw) as TwilioMessage;
        } catch (error) {
            console.error("[VoiceBridge] Invalid Twilio message:", error);
            return;
        }

        switch (message.event) {
            case "connected":
                return;
            case "start":
                await this.handleStart(message);
                return;
            case "media":
                this.handleMedia(message);
                return;
            case "stop":
                await this.handleStop();
                return;
            default:
                return;
        }
    }

    async shutdown() {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        try {
            this.twilioWs.close();
        } catch {
            // Ignore errors
        }
        try {
            this.elevenWs?.close();
        } catch {
            // Ignore errors
        }
        await this.persistMetadata();
    }

    private async handleStart(message: TwilioStartMessage) {
        this.streamSid = message.start.streamSid;
        this.callSid = message.start.callSid;
        this.markers.streamStartedAt = Date.now();

        const customParams = message.start.customParameters || {};
        this.agentId =
            customParams.agentId ||
            process.env.ELEVENLABS_MCP_AGENT_ID ||
            process.env.ELEVENLABS_AGENT_ID ||
            "";

        if (AUTH_TOKEN && customParams.token !== AUTH_TOKEN) {
            console.warn("[VoiceBridge] Invalid auth token, closing stream");
            await this.shutdown();
            return;
        }

        if (!ELEVENLABS_API_KEY) {
            console.error("[VoiceBridge] ELEVENLABS_API_KEY not configured");
            await this.shutdown();
            return;
        }

        await this.connectToElevenLabs();
    }

    private handleMedia(message: TwilioMediaMessage) {
        if (message.media?.track && message.media.track !== "inbound") {
            return;
        }

        if (!this.markers.firstInboundAudioAt) {
            this.markers.firstInboundAudioAt = Date.now();
        }

        const mulawBuffer = Buffer.from(message.media.payload, "base64");
        const pcmSamples = mulawToLinearSamples(mulawBuffer);
        const resampled = resampleLinear(
            pcmSamples,
            TWILIO_SAMPLE_RATE,
            this.elevenInputSampleRate
        );
        const base64Pcm = bufferFromInt16(resampled).toString("base64");

        if (this.elevenWs && this.elevenWs.readyState === WebSocket.OPEN) {
            this.elevenWs.send(JSON.stringify({ user_audio_chunk: base64Pcm }));
            return;
        }

        if (this.pendingAudioChunks.length < MAX_PENDING_CHUNKS) {
            this.pendingAudioChunks.push(base64Pcm);
        }
    }

    private async handleStop() {
        this.markers.streamEndedAt = Date.now();
        await this.shutdown();
    }

    private async connectToElevenLabs() {
        const agentId =
            this.agentId ||
            process.env.ELEVENLABS_MCP_AGENT_ID ||
            process.env.ELEVENLABS_AGENT_ID ||
            "";

        const signedUrl = await getElevenLabsSignedUrl(agentId);
        if (!signedUrl) {
            console.error("[VoiceBridge] Failed to get ElevenLabs signed URL");
            await this.shutdown();
            return;
        }

        this.elevenWs = new WebSocket(signedUrl, {
            perMessageDeflate: false
        });
        this.enableLowLatencySocket(this.elevenWs);

        this.elevenWs.on("open", () => {
            this.markers.elevenlabsConnectedAt = Date.now();
            this.elevenWs?.send(JSON.stringify({ type: "conversation_initiation_client_data" }));

            for (const chunk of this.pendingAudioChunks) {
                this.elevenWs?.send(JSON.stringify({ user_audio_chunk: chunk }));
            }
            this.pendingAudioChunks = [];
        });

        this.elevenWs.on("message", (data: RawData) => {
            this.handleElevenLabsMessage(data.toString());
        });

        this.elevenWs.on("close", () => {
            this.elevenWs = null;
        });

        this.elevenWs.on("error", (error: Error) => {
            console.error("[VoiceBridge] ElevenLabs WebSocket error:", error);
        });
    }

    private handleElevenLabsMessage(raw: string) {
        let message: ElevenLabsServerEvent;
        try {
            message = JSON.parse(raw) as ElevenLabsServerEvent;
        } catch (error) {
            console.error("[VoiceBridge] Invalid ElevenLabs message:", error);
            return;
        }

        if (message.type === "conversation_initiation_metadata") {
            this.conversationId = message.conversation_initiation_metadata_event.conversation_id;
            this.elevenOutputSampleRate = parsePcmSampleRate(
                message.conversation_initiation_metadata_event.agent_output_audio_format
            );
            return;
        }

        if (message.type === "ping") {
            this.elevenWs?.send(
                JSON.stringify({ type: "pong", event_id: message.ping_event.event_id })
            );
            return;
        }

        if (message.type === "interruption") {
            this.sendTwilioClear();
            return;
        }

        if (message.type === "audio") {
            if (!this.markers.firstElevenlabsAudioAt) {
                this.markers.firstElevenlabsAudioAt = Date.now();
            }
            this.sendAudioToTwilio(message.audio_event.audio_base_64);
        }
    }

    private sendAudioToTwilio(audioBase64: string) {
        if (!this.streamSid || this.twilioWs.readyState !== WebSocket.OPEN) {
            return;
        }

        const pcmBuffer = Buffer.from(audioBase64, "base64");
        const pcmSamples = int16FromBuffer(pcmBuffer);
        const resampled = resampleLinear(
            pcmSamples,
            this.elevenOutputSampleRate,
            TWILIO_SAMPLE_RATE
        );
        const mulawPayload = linearSamplesToMulaw(resampled).toString("base64");

        if (!this.markers.firstTwilioAudioOutAt) {
            this.markers.firstTwilioAudioOutAt = Date.now();
        }

        this.twilioWs.send(
            JSON.stringify({
                event: "media",
                streamSid: this.streamSid,
                media: { payload: mulawPayload }
            })
        );
    }

    private sendTwilioClear() {
        if (!this.streamSid || this.twilioWs.readyState !== WebSocket.OPEN) {
            return;
        }
        this.twilioWs.send(JSON.stringify({ event: "clear", streamSid: this.streamSid }));
    }

    private enableLowLatencySocket(socket: WebSocket | null) {
        const rawSocket =
            socket &&
            (socket as WebSocket & { _socket?: { setNoDelay: (v: boolean) => void } })._socket;
        if (rawSocket?.setNoDelay) {
            rawSocket.setNoDelay(true);
        }
    }

    private async persistMetadata() {
        if (!this.callSid) {
            return;
        }

        const metadata = {
            streamSid: this.streamSid,
            agentId: this.agentId,
            conversationId: this.conversationId,
            timing: this.markers
        };

        try {
            const { prisma } = await import("@repo/database");
            await prisma.voiceCallLog.updateMany({
                where: { callSid: this.callSid },
                data: { metadata }
            });
        } catch (error) {
            console.error("[VoiceBridge] Failed to persist metadata:", error);
        }
    }
}

const server = createServer();
const wss = new WebSocketServer({
    server,
    path: PATH,
    perMessageDeflate: false
});

wss.on("connection", (ws: WebSocket) => {
    const session = new VoiceBridgeSession(ws);

    ws.on("message", (data: RawData) => {
        session.handleTwilioMessage(data.toString());
    });

    ws.on("close", () => {
        session.shutdown();
    });

    ws.on("error", (error: Error) => {
        console.error("[VoiceBridge] Twilio WebSocket error:", error);
        session.shutdown();
    });
});

server.listen(PORT, () => {
    console.log(`[VoiceBridge] Listening on ws://localhost:${PORT}${PATH}`);
});

async function getElevenLabsSignedUrl(agentId: string): Promise<string | null> {
    if (!ELEVENLABS_API_KEY || !agentId) {
        return null;
    }

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agentId}`,
            {
                method: "GET",
                headers: {
                    "xi-api-key": ELEVENLABS_API_KEY
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[VoiceBridge] ElevenLabs signed URL error:", errorText);
            return null;
        }

        const data = await response.json();
        return data.signed_url || null;
    } catch (error) {
        console.error("[VoiceBridge] Signed URL request failed:", error);
        return null;
    }
}

function parsePcmSampleRate(format: string): number {
    const match = format.match(/pcm_(\d+)/);
    if (match) {
        return Number(match[1]);
    }
    return DEFAULT_ELEVEN_INPUT_RATE;
}

function resampleLinear(input: Int16Array, fromRate: number, toRate: number): Int16Array {
    if (fromRate === toRate) {
        return input;
    }

    const ratio = toRate / fromRate;
    const outputLength = Math.max(1, Math.floor(input.length * ratio));
    const output = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const sourceIndex = i / ratio;
        const leftIndex = Math.floor(sourceIndex);
        const rightIndex = Math.min(leftIndex + 1, input.length - 1);
        const fraction = sourceIndex - leftIndex;
        const leftSample = input[leftIndex] ?? 0;
        const rightSample = input[rightIndex] ?? leftSample;
        output[i] = leftSample + (rightSample - leftSample) * fraction;
    }

    return output;
}

function bufferFromInt16(samples: Int16Array): Buffer {
    return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
}

function int16FromBuffer(buffer: Buffer): Int16Array {
    return new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 2));
}

function mulawToLinearSamples(buffer: Buffer): Int16Array {
    const output = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        output[i] = muLawToLinear(buffer[i]);
    }
    return output;
}

function linearSamplesToMulaw(samples: Int16Array): Buffer {
    const output = Buffer.alloc(samples.length);
    for (let i = 0; i < samples.length; i++) {
        output[i] = linearToMuLaw(samples[i]);
    }
    return output;
}

const MU_LAW_BIAS = 0x84;
const MU_LAW_CLIP = 32635;

function linearToMuLaw(sample: number): number {
    const sign = (sample >> 8) & 0x80;
    if (sign !== 0) {
        sample = -sample;
    }
    if (sample > MU_LAW_CLIP) {
        sample = MU_LAW_CLIP;
    }
    sample += MU_LAW_BIAS;

    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
        exponent -= 1;
    }
    const mantissa = (sample >> (exponent + 3)) & 0x0f;
    const muLawByte = ~(sign | (exponent << 4) | mantissa);
    return muLawByte & 0xff;
}

function muLawToLinear(muLawByte: number): number {
    const muLaw = ~muLawByte;
    const sign = muLaw & 0x80;
    const exponent = (muLaw >> 4) & 0x07;
    const mantissa = muLaw & 0x0f;
    let sample = ((mantissa << 3) + MU_LAW_BIAS) << exponent;
    sample -= MU_LAW_BIAS;
    return sign ? -sample : sample;
}
