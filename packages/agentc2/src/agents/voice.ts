import { CompositeVoice } from "@mastra/core/voice";
import { OpenAIVoice } from "@mastra/voice-openai";
import { ElevenLabsVoice } from "@mastra/voice-elevenlabs";

/**
 * Voice provider factories that accept explicit API keys.
 * Agent instances should pass keys resolved from the database.
 */
export const voiceProviders = {
    openai: (apiKey: string) =>
        new OpenAIVoice({
            speechModel: {
                name: "tts-1",
                apiKey
            },
            listeningModel: {
                name: "whisper-1",
                apiKey
            },
            speaker: "alloy"
        }),

    elevenlabs: (apiKey: string) =>
        new ElevenLabsVoice({
            speechModel: {
                name: "eleven_multilingual_v2",
                apiKey
            }
        }),

    hybrid: (openaiKey: string, elevenlabsKey: string) =>
        new CompositeVoice({
            input: new OpenAIVoice({
                listeningModel: {
                    name: "whisper-1",
                    apiKey: openaiKey
                }
            }),
            output: new ElevenLabsVoice({
                speechModel: {
                    name: "eleven_multilingual_v2",
                    apiKey: elevenlabsKey
                }
            })
        })
};

/**
 * Available OpenAI speakers
 */
export const openaiSpeakers = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;
export type OpenAISpeaker = (typeof openaiSpeakers)[number];
