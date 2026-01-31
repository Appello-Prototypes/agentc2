/**
 * Audio Player for ElevenLabs Streaming Audio
 *
 * Handles:
 * - Queue-based audio chunk playback
 * - Streaming playback (starts playing before all chunks arrive)
 * - Interruption (immediate stop on barge-in)
 * - Web Audio API for low latency
 */

export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private audioQueue: AudioBuffer[] = [];
    private isPlaying = false;
    private currentSource: AudioBufferSourceNode | null = null;
    private nextStartTime = 0;
    private onPlaybackStart?: () => void;
    private onPlaybackEnd?: () => void;
    private outputFormat: string = "pcm_16000"; // Default format

    constructor(options?: { onPlaybackStart?: () => void; onPlaybackEnd?: () => void }) {
        this.onPlaybackStart = options?.onPlaybackStart;
        this.onPlaybackEnd = options?.onPlaybackEnd;
    }

    /**
     * Initialize the audio context (must be called after user interaction)
     */
    async init(): Promise<void> {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }
        if (this.audioContext.state === "suspended") {
            await this.audioContext.resume();
        }
    }

    /**
     * Set the audio output format from ElevenLabs
     */
    setOutputFormat(format: string): void {
        this.outputFormat = format;
    }

    /**
     * Add an audio chunk to the queue and start playing if not already
     */
    async addChunk(base64Audio: string): Promise<void> {
        if (!this.audioContext) {
            await this.init();
        }

        try {
            const audioBuffer = await this.decodeAudioChunk(base64Audio);
            this.audioQueue.push(audioBuffer);

            if (!this.isPlaying) {
                this.startPlayback();
            }
        } catch (error) {
            console.error("Failed to decode audio chunk:", error);
        }
    }

    /**
     * Decode base64 audio to AudioBuffer
     */
    private async decodeAudioChunk(base64Audio: string): Promise<AudioBuffer> {
        if (!this.audioContext) {
            throw new Error("AudioContext not initialized");
        }

        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Handle PCM format (raw audio data)
        if (this.outputFormat.startsWith("pcm_")) {
            const sampleRate = parseInt(this.outputFormat.split("_")[1]) || 16000;
            return this.decodePCM(bytes, sampleRate);
        }

        // Handle encoded formats (mp3, etc)
        try {
            return await this.audioContext.decodeAudioData(bytes.buffer);
        } catch {
            // Fallback: try as PCM 16000
            return this.decodePCM(bytes, 16000);
        }
    }

    /**
     * Decode PCM 16-bit audio to AudioBuffer
     */
    private decodePCM(bytes: Uint8Array, sampleRate: number): AudioBuffer {
        if (!this.audioContext) {
            throw new Error("AudioContext not initialized");
        }

        // PCM 16-bit = 2 bytes per sample
        const numSamples = bytes.length / 2;
        const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
        const channelData = audioBuffer.getChannelData(0);

        const dataView = new DataView(bytes.buffer);
        for (let i = 0; i < numSamples; i++) {
            // Read 16-bit signed integer, little-endian
            const sample = dataView.getInt16(i * 2, true);
            // Normalize to -1.0 to 1.0
            channelData[i] = sample / 32768;
        }

        return audioBuffer;
    }

    /**
     * Start playing queued audio chunks
     */
    private startPlayback(): void {
        if (!this.audioContext || this.audioQueue.length === 0) {
            return;
        }

        this.isPlaying = true;
        this.nextStartTime = this.audioContext.currentTime;
        this.onPlaybackStart?.();
        this.playNextChunk();
    }

    /**
     * Play the next chunk in the queue
     */
    private playNextChunk(): void {
        if (!this.audioContext || this.audioQueue.length === 0) {
            this.isPlaying = false;
            this.currentSource = null;
            this.onPlaybackEnd?.();
            return;
        }

        const audioBuffer = this.audioQueue.shift()!;
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // Schedule this chunk to play after the previous one
        const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
        source.start(startTime);
        this.nextStartTime = startTime + audioBuffer.duration;

        this.currentSource = source;

        // When this chunk ends, play the next one
        source.onended = () => {
            if (this.currentSource === source) {
                this.playNextChunk();
            }
        };
    }

    /**
     * Immediately stop all audio playback (for barge-in)
     */
    interrupt(): void {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch {
                // Source may have already stopped
            }
            this.currentSource = null;
        }

        this.audioQueue = [];
        this.isPlaying = false;
        this.onPlaybackEnd?.();
    }

    /**
     * Clear the queue but let current chunk finish
     */
    clearQueue(): void {
        this.audioQueue = [];
    }

    /**
     * Get current playback state
     */
    getState(): { isPlaying: boolean; queueLength: number } {
        return {
            isPlaying: this.isPlaying,
            queueLength: this.audioQueue.length
        };
    }

    /**
     * Clean up resources
     */
    async dispose(): Promise<void> {
        this.interrupt();
        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }
    }
}
