/**
 * ElevenLabs Conversational AI WebSocket Types
 * https://elevenlabs.io/docs/conversational-ai/api-reference/conversational-ai/websocket
 */

// ============================================================================
// Client → Server Events
// ============================================================================

export interface ConversationInitiationClientData {
    type: "conversation_initiation_client_data";
    conversation_config_override?: {
        agent?: {
            prompt?: {
                prompt?: string;
            };
            first_message?: string;
            language?: string;
        };
        tts?: {
            voice_id?: string;
        };
    };
    custom_llm_extra_body?: Record<string, unknown>;
    dynamic_variables?: Record<string, string>;
}

export interface UserAudioChunk {
    user_audio_chunk: string; // base64 encoded audio
}

export interface PongEvent {
    type: "pong";
    event_id: number;
}

export interface ContextualUpdateEvent {
    type: "contextual_update";
    text: string;
}

export interface ClientToolResult {
    type: "client_tool_result";
    tool_call_id: string;
    result: string;
    is_error: boolean;
}

export type ClientEvent =
    | ConversationInitiationClientData
    | UserAudioChunk
    | PongEvent
    | ContextualUpdateEvent
    | ClientToolResult;

// ============================================================================
// Server → Client Events
// ============================================================================

export interface ConversationInitiationMetadata {
    type: "conversation_initiation_metadata";
    conversation_initiation_metadata_event: {
        conversation_id: string;
        agent_output_audio_format: string;
    };
}

export interface UserTranscriptEvent {
    type: "user_transcript";
    user_transcription_event: {
        user_transcript: string;
    };
}

export interface AgentResponseEvent {
    type: "agent_response";
    agent_response_event: {
        agent_response: string;
    };
}

export interface AgentResponseCorrectionEvent {
    type: "agent_response_correction";
    agent_response_correction_event: {
        original_agent_response: string;
        corrected_agent_response: string;
    };
}

export interface AudioEvent {
    type: "audio";
    audio_event: {
        audio_base_64: string;
        event_id: number;
    };
}

export interface InterruptionEvent {
    type: "interruption";
    interruption_event: {
        event_id: number;
    };
}

export interface PingEvent {
    type: "ping";
    ping_event: {
        event_id: number;
        ping_ms?: number;
    };
}

export interface ClientToolCallEvent {
    type: "client_tool_call";
    client_tool_call: {
        tool_call_id: string;
        tool_name: string;
        parameters: Record<string, unknown>;
    };
}

export interface VADScoreEvent {
    type: "vad_score";
    vad_score_event: {
        score: number;
    };
}

export interface InternalTentativeAgentResponseEvent {
    type: "internal_tentative_agent_response";
    tentative_agent_response_internal_event: {
        tentative_agent_response: string;
    };
}

export type ServerEvent =
    | ConversationInitiationMetadata
    | UserTranscriptEvent
    | AgentResponseEvent
    | AgentResponseCorrectionEvent
    | AudioEvent
    | InterruptionEvent
    | PingEvent
    | ClientToolCallEvent
    | VADScoreEvent
    | InternalTentativeAgentResponseEvent;

// ============================================================================
// Connection State
// ============================================================================

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type AgentState = "idle" | "listening" | "thinking" | "speaking";

export interface ConversationMessage {
    id: string;
    role: "user" | "agent";
    content: string;
    timestamp: Date;
    isFinal?: boolean;
}

export interface ConversationState {
    status: ConnectionStatus;
    agentState: AgentState;
    conversationId: string | null;
    messages: ConversationMessage[];
    currentUserTranscript: string;
    currentAgentResponse: string;
    latencyMs: number | null;
    error: string | null;
}
