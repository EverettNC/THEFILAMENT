import type { AudioBus } from "./types";
import { blobToBase64, concatFloat32, downsample, encodeWav } from "./wav";

export const MAX_SECONDS = 90;
const TARGET_RATE = 16000;

export type MicHandle = {
  start: () => Promise<void>;
  stop: () => Promise<{ base64: string; mimeType: string; duration: number } | null>;
  cancel: () => void;
};

export function createMic(audio: AudioBus): MicHandle {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let analyser: AnalyserNode | null = null;
  let raf = 0;
  let chunks: Float32Array[] = [];
  let startedAt = 0;
  let running = false;

  function pumpMeters() {
    if (!analyser || !running) return;
    const bins: Uint8Array<ArrayBuffer> =
      audio.bins ?? new Uint8Array(analyser.frequencyBinCount);
    if (!audio.bins) audio.bins = bins;
    analyser.getByteFrequencyData(bins);
    let sum = 0;
    for (let i = 0; i < bins.length; i++) sum += bins[i] ?? 0;
    const avg = sum / (bins.length * 255);
    audio.energy = Math.min(1, avg * 3.2);
    raf = requestAnimationFrame(pumpMeters);
  }

  async function start() {
    if (running) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser cannot open a microphone.");
    }
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);

    processor = ctx.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (ev) => {
      if (!running) return;
      const input = ev.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(ctx.destination);

    chunks = [];
    startedAt = performance.now();
    running = true;
    audio.listening = true;
    audio.processing = false;
    audio.energy = 0;
    pumpMeters();
  }

  function teardown() {
    running = false;
    audio.listening = false;
    audio.energy *= 0.4;
    cancelAnimationFrame(raf);
    try {
      processor?.disconnect();
    } catch {
      /* ignore */
    }
    processor = null;
    try {
      analyser?.disconnect();
    } catch {
      /* ignore */
    }
    analyser = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void ctx?.close();
    ctx = null;
  }

  async function stop() {
    if (!running) return null;
    const duration = (performance.now() - startedAt) / 1000;
    const nativeRate = ctx?.sampleRate ?? TARGET_RATE;
    const captured = chunks;
    teardown();
    if (duration < 0.35 || captured.length === 0) return null;
    const merged = concatFloat32(captured);
    const pcm = downsample(merged, nativeRate, TARGET_RATE);
    const wav = encodeWav(pcm, TARGET_RATE);
    const base64 = await blobToBase64(new Blob([wav], { type: "audio/wav" }));
    return { base64, mimeType: "audio/wav", duration };
  }

  function cancel() {
    chunks = [];
    teardown();
  }

  return { start, stop, cancel };
}
