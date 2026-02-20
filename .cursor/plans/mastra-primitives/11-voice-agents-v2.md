# Voice Agents V2: Low-Latency Real-Time Conversation

## Overview

Upgrade the voice demo from STT→LLM→TTS cascade to ElevenLabs Agents Platform with real-time WebSocket streaming, then add Mastra sub-agent tool integration.

## Current State

- **Architecture**: Cascade pattern (Whisper STT → Claude Sonnet 4 → ElevenLabs TTS)
- **Streaming**: SSE for text, audio chunks collected before playback
- **Latency**: ~2-4s to first audible response
- **Features**: No barge-in, no tools, no interruption handling

## Target State

### Phase 1: Real-Time Conversation

- **Architecture**: ElevenLabs Agents WebSocket (speech-in → speech-out)
- **Latency**: Sub-1s to first audible response
- **Features**: Barge-in support, streaming audio playback, interruption handling

### Phase 2: Sub-Agent Tools

- **Architecture**: ElevenLabs → Server Tool → Mastra agents → Response
- **Features**: Query calendar, email, CRM via voice commands

---

## Phase 1: Real-Time Conversation

### Prerequisites

1. **ElevenLabs Agent** - Create an agent in ElevenLabs dashboard
    - Configure voice, system prompt, LLM
    - Get `agent_id` for WebSocket connection
    - Note: This is the Agents Platform, not just the TTS API

2. **Environment Variables**
    ```env
    ELEVENLABS_AGENT_ID=your-agent-id
    ELEVENLABS_API_KEY=your-api-key  # For signed URLs (private agents)
    ```

### Implementation Tasks

#### 1.1 Create WebSocket Types

**File**: `apps/agent/src/types/elevenlabs-websocket.ts`

```typescript
// Client → Server events
export type ClientEvent =
  | { type: 'conversation_initiation_client_data'; ... }
  | { user_audio_chunk: string }  // base64 audio
  | { type: 'pong'; event_id: number }
  | { type: 'contextual_update'; text: string }

// Server → Client events
export type ServerEvent =
  | { type: 'user_transcript'; user_transcription_event: { user_transcript: string } }
  | { type: 'agent_response'; agent_response_event: { agent_response: string } }
  | { type: 'audio'; audio_event: { audio_base_64: string; event_id: number } }
  | { type: 'interruption'; interruption_event: { reason: string } }
  | { type: 'ping'; ping_event: { event_id: number; ping_ms?: number } }
  | { type: 'client_tool_call'; ... }
```

#### 1.2 Create React Hook for Agent Conversation

**File**: `apps/agent/src/hooks/useElevenLabsAgent.ts`

Key responsibilities:

- WebSocket connection management
- Audio capture via `voice-stream` or Web Audio API
- Audio playback with queue management
- Barge-in / interruption handling
- Ping/pong keepalive
- Transcript state management

#### 1.3 Create Audio Playback Manager

**File**: `apps/agent/src/lib/audio-player.ts`

Key responsibilities:

- Queue incoming audio chunks
- Stream playback (don't wait for all chunks)
- Handle interruption (stop playback immediately)
- Web Audio API for low-latency

#### 1.4 API Route for Signed URLs (Private Agents)

**File**: `apps/agent/src/app/api/demos/voice/signed-url/route.ts`

```typescript
// GET /api/demos/voice/signed-url
// Returns signed WebSocket URL for private agents
export async function GET() {
    const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${AGENT_ID}`,
        { headers: { "xi-api-key": API_KEY } }
    );
    const { signed_url } = await response.json();
    return NextResponse.json({ signed_url });
}
```

#### 1.5 Update Voice Demo Page - New "Live Agent" Tab

**File**: `apps/agent/src/app/demos/voice/page.tsx`

New tab that replaces/enhances "Live Voice":

- Large circular talk button (push-to-talk or continuous)
- Real-time transcript display (user + agent)
- Visual feedback for:
    - Connection status
    - Voice activity (user speaking)
    - Agent speaking
    - Interruption
- Latency indicator (ping RTT)

### UI/UX Design

```
┌─────────────────────────────────────────┐
│  ● Connected  |  RTT: 45ms              │
├─────────────────────────────────────────┤
│                                         │
│  User: What's on my calendar today?     │
│                                         │
│  Agent: You have 3 meetings today...    │
│         [speaking animation]            │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│            ┌─────────┐                  │
│            │  🎤     │  ← Tap to talk   │
│            │  TALK   │    (or hold)     │
│            └─────────┘                  │
│                                         │
│     [Disconnect]  [Clear History]       │
└─────────────────────────────────────────┘
```

### Dependencies

```bash
# For audio capture
npm install voice-stream

# Or use native Web Audio API (no dependency)
```

---

## Phase 2: Sub-Agent Tools

### Architecture

```
Browser ←→ ElevenLabs Agents WebSocket
                    │
                    ↓ Server Tool Call
         POST /api/demos/voice/tools/gather-context
                    │
                    ↓ Fan out to Mastra agents
         ┌─────────┼─────────┐
         ↓         ↓         ↓
     Calendar   Gmail    HubSpot
      Agent     Agent     Agent
         ↓         ↓         ↓
         └─────────┼─────────┘
                   ↓
           Merged Response → ElevenLabs
```

### Implementation Tasks

#### 2.1 Configure Server Tool in ElevenLabs Dashboard

Tool definition:

```json
{
    "name": "gather_context",
    "description": "Gather information from various sources like calendar, email, or CRM based on user query",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The user's question or information need"
            },
            "sources": {
                "type": "array",
                "items": { "type": "string", "enum": ["calendar", "email", "crm", "all"] },
                "description": "Which sources to query"
            }
        },
        "required": ["query"]
    }
}
```

Server Tool URL: `https://your-domain.com/api/demos/voice/tools/gather-context`

#### 2.2 Create Tool Endpoint

**File**: `apps/agent/src/app/api/demos/voice/tools/gather-context/route.ts`

```typescript
export async function POST(req: Request) {
    const { query, sources = ["all"] } = await req.json();

    // Fan out to Mastra agents in parallel
    const results = await Promise.all([
        sources.includes("calendar") || sources.includes("all")
            ? calendarAgent.generate(query)
            : null,
        sources.includes("email") || sources.includes("all") ? emailAgent.generate(query) : null,
        sources.includes("crm") || sources.includes("all") ? crmAgent.generate(query) : null
    ]);

    // Merge and summarize results
    const summary = mergeResults(results);

    return NextResponse.json({
        success: true,
        data: summary
    });
}
```

#### 2.3 Create Mastra Sub-Agents

**File**: `packages/agentc2/src/agents/voice-tools.ts`

Specialist agents:

- `calendarAgent` - Uses Google Calendar MCP
- `emailAgent` - Uses Gmail MCP
- `crmAgent` - Uses HubSpot MCP

Each agent:

- Has focused system prompt
- Has access to specific MCP tools
- Returns structured summary

#### 2.4 Update Voice Demo UI for Tools

Show tool execution feedback:

- "Checking your calendar..."
- "Looking up recent emails..."
- Tool call indicators in conversation

---

## Success Metrics

### Phase 1

- [ ] WebSocket connection established successfully
- [ ] Audio captured and streamed to ElevenLabs
- [ ] Agent audio received and played in real-time
- [ ] Barge-in works (user can interrupt agent)
- [ ] Latency < 1s to first audible response
- [ ] Conversation transcript displays correctly

### Phase 2

- [ ] Tool calls triggered by voice commands
- [ ] Sub-agents execute in parallel
- [ ] Results merged and spoken back
- [ ] Tool execution shown in UI
- [ ] End-to-end latency still < 2s with tools

---

## ElevenLabs Agent Configuration

### Recommended Settings

**Voice**: Choose a conversational voice (not too formal)

**System Prompt**:

```
You are a helpful voice assistant. Keep responses concise (1-3 sentences unless
the user asks for details). You have access to tools to look up calendar events,
emails, and CRM information. When the user asks about their schedule, emails,
or contacts, use the gather_context tool to get real information.
```

**LLM**: GPT-4 or Claude for best tool-calling reliability

**Turn Detection**:

- End of speech sensitivity: Medium
- Minimum speech duration: 300ms

---

## Files to Create/Modify

### Phase 1

| Action | File                                                     |
| ------ | -------------------------------------------------------- |
| Create | `apps/agent/src/types/elevenlabs-websocket.ts`           |
| Create | `apps/agent/src/hooks/useElevenLabsAgent.ts`             |
| Create | `apps/agent/src/lib/audio-player.ts`                     |
| Create | `apps/agent/src/app/api/demos/voice/signed-url/route.ts` |
| Modify | `apps/agent/src/app/demos/voice/page.tsx` (new tab)      |
| Modify | `.env.example` (add ELEVENLABS_AGENT_ID)                 |

### Phase 2

| Action | File                                                               |
| ------ | ------------------------------------------------------------------ |
| Create | `apps/agent/src/app/api/demos/voice/tools/gather-context/route.ts` |
| Create | `packages/agentc2/src/agents/voice-tools.ts`                        |
| Modify | `packages/agentc2/src/mastra.ts` (register new agents)              |
| Modify | `apps/agent/src/app/demos/voice/page.tsx` (tool indicators)        |

---

## References

- [ElevenLabs WebSocket Docs](https://elevenlabs.io/docs/conversational-ai/libraries/web-sockets)
- [ElevenLabs Server Tools](https://elevenlabs.io/docs/agents-platform/customization/tools/server-tools)
- [ElevenLabs Agent Configuration](https://elevenlabs.io/docs/agents-platform/build/overview)
- [voice-stream npm package](https://www.npmjs.com/package/voice-stream)
