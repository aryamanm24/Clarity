/**
 * PCM Playback Processor with Jitter Buffer
 *
 * Runs OFF the main thread in an AudioWorklet.
 * Accumulates PCM samples in a ring buffer and drains them at a steady rate.
 * This eliminates gaps caused by network jitter or main thread blocking.
 */
class PCMPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Ring buffer — pre-allocate for ~5 seconds of audio at 24kHz
    this.ringBuffer = new Float32Array(24000 * 5);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.bufferedSamples = 0;

    // Jitter buffer config
    this.PRE_BUFFER_SAMPLES = 24000 * 0.3; // 300ms pre-buffer before playback starts
    this.isPlaying = false;
    this.hasStarted = false; // True after first audio received
    this.silenceCounter = 0;
    this.SILENCE_THRESHOLD = 24000 * 2; // 2 seconds of silence = stop

    this.port.onmessage = (e) => {
      if (e.data.type === "audio") {
        // Receive raw bytes (Int16 PCM), convert to Float32, write to ring buffer
        const int16 = new Int16Array(e.data.buffer);

        for (let i = 0; i < int16.length; i++) {
          this.ringBuffer[this.writeIndex] = int16[i] / 32768.0;
          this.writeIndex = (this.writeIndex + 1) % this.ringBuffer.length;
          this.bufferedSamples++;
        }

        this.hasStarted = true;
        this.silenceCounter = 0;

        // Start playback once we have enough buffered
        if (!this.isPlaying && this.bufferedSamples >= this.PRE_BUFFER_SAMPLES) {
          this.isPlaying = true;
          this.port.postMessage({ type: "playback_started" });
        }
      } else if (e.data.type === "clear") {
        // Reset everything
        this.writeIndex = 0;
        this.readIndex = 0;
        this.bufferedSamples = 0;
        this.isPlaying = false;
        this.hasStarted = false;
        this.silenceCounter = 0;
        this.port.postMessage({ type: "playback_stopped" });
      } else if (e.data.type === "set_prebuffer") {
        // Allow dynamic pre-buffer adjustment
        this.PRE_BUFFER_SAMPLES = e.data.samples;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const channel = output[0]; // Mono output

    if (this.isPlaying && this.bufferedSamples > 0) {
      for (let i = 0; i < channel.length; i++) {
        if (this.bufferedSamples > 0) {
          channel[i] = this.ringBuffer[this.readIndex];
          this.readIndex = (this.readIndex + 1) % this.ringBuffer.length;
          this.bufferedSamples--;
        } else {
          channel[i] = 0;
        }
      }
      this.silenceCounter = 0;
    } else {
      // Fill with silence
      for (let i = 0; i < channel.length; i++) {
        channel[i] = 0;
      }

      // Track how long we've been silent
      if (this.hasStarted) {
        this.silenceCounter += channel.length;
        if (this.silenceCounter >= this.SILENCE_THRESHOLD) {
          // Buffer drained and no new audio for 2 seconds — playback is done
          this.isPlaying = false;
          this.hasStarted = false;
          this.silenceCounter = 0;
          this.port.postMessage({ type: "playback_stopped" });
        }
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor("pcm-playback-processor", PCMPlaybackProcessor);
