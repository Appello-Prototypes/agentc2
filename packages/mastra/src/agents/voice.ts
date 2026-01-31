import { Agent } from "@mastra/core/agent";
import { CompositeVoice } from "@mastra/core/voice";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";

/**
 * Voice configurations for different use cases
 */
export const voiceProviders = {
    openai: () =>
        new OpenAIVoice({
            speechModel: {
                name: "tts-1",
                apiKey: process.env.OPENAI_API_KEY
            },
            listeningModel: {
                name: "whisper-1",
                apiKey: process.env.OPENAI_API_KEY
            },
            speaker: "alloy"
        }),

    elevenlabs: () =>
        new ElevenLabsVoice({
            speechModel: {
                model: "eleven_turbo_v2_5",
                apiKey: process.env.ELEVENLABS_API_KEY
            }
        }),

    // Hybrid: OpenAI for STT, ElevenLabs for premium TTS
    hybrid: () =>
        new CompositeVoice({
            input: new OpenAIVoice({
                listeningModel: {
                    name: "whisper-1",
                    apiKey: process.env.OPENAI_API_KEY
                }
            }),
            output: new ElevenLabsVoice({
                speechModel: {
                    model: "eleven_turbo_v2_5",
                    apiKey: process.env.ELEVENLABS_API_KEY
                }
            })
        })
};

// Check for API keys at module load time
const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;

/**
 * OpenAI Voice Agent
 *
 * Uses OpenAI for both TTS and STT.
 * Good balance of quality and cost.
 */
export const openaiVoiceAgent = hasOpenAIKey
    ? new Agent({
          id: "openai-voice-agent",
          name: "OpenAI Voice Agent",
          instructions: `You are a helpful voice assistant. Keep responses concise and conversational 
since they will be spoken aloud. Aim for 1-3 sentences unless more detail is requested.`,
          model: "anthropic/claude-sonnet-4-20250514",
          voice: voiceProviders.openai()
      })
    : undefined;

/**
 * ElevenLabs Voice Agent
 *
 * Uses ElevenLabs for premium TTS quality.
 * Best for production voice experiences.
 */
export const elevenlabsVoiceAgent = hasElevenLabsKey
    ? new Agent({
          id: "elevenlabs-voice-agent",
          name: "ElevenLabs Voice Agent",
          instructions: `You are a helpful voice assistant with a premium, natural voice. 
Keep responses conversational and engaging. Aim for 1-3 sentences.`,
          model: "anthropic/claude-sonnet-4-20250514",
          voice: voiceProviders.elevenlabs()
      })
    : undefined;

/**
 * Hybrid Voice Agent
 *
 * Uses OpenAI Whisper for STT (proven accuracy)
 * Uses ElevenLabs for TTS (premium quality)
 */
export const hybridVoiceAgent =
    hasOpenAIKey && hasElevenLabsKey
        ? new Agent({
              id: "hybrid-voice-agent",
              name: "Hybrid Voice Agent",
              instructions: `You are a helpful voice assistant combining the best of both worlds.
Keep responses natural and conversational.`,
              model: "anthropic/claude-sonnet-4-20250514",
              voice: voiceProviders.hybrid()
          })
        : undefined;

/**
 * Available OpenAI speakers
 */
export const openaiSpeakers = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
export type OpenAISpeaker = (typeof openaiSpeakers)[number];
