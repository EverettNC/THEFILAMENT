/** Live Filament ear. Local Vosk on :4850. Not vosk-browser. Not Whisper. */

import {
  FILAMENT_LIVE,
  filamentLiveUrl,
  probeFilamentEar,
  UNSEATED,
} from "./ear.ts";
import type { AudioBus } from "./types.ts";

export const LIVE_CHUNK = 3200;
const TARGET_RATE = 16000;

export type LiveHooks = {
  onPartial: (text: string) => void;
  onUtterance: (text: string) => void;
};

export type FilamentLiveEngine = {
  load: (onProgress?: (ratio: number) => void) => Promise<void>;
  startLive: (bus: AudioBus, hooks: LiveHooks) => Promise<void>;
  stopLive: () => Promise<{ text: string }>;
  cancelLive: () => void;
};

export function pcm16Downsample(input: Float32Array, inRate: number): Int16Array {
  const ratio = inRate / TARGET_RATE;
  const n = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function energyOf(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / Math.max(1, samples.length)) * 8);
}

function livePost(pcm: Int16Array, query = ""): Promise<Record<string, unknown>> {
  // Copy the samples into a plain ArrayBuffer so fetch accepts it as a body.
  const bytes = new Uint8Array(pcm.byteLength);
  bytes.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
  return fetch(`${filamentLiveUrl()}${query}`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: bytes,
  }).then(async (res) => {
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok && !body.ok) {
      throw new Error(typeof body.error === "string" ? body.error : UNSEATED);
    }
    return body;
  });
}

function createLiveEar(): FilamentLiveEngine {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let proc: ScriptProcessorNode | null = null;
  let listening = false;
  let queue: Promise<unknown> = Promise.resolve();
  let lastText = "";
  let busRef: AudioBus | null = null;

  function teardown() {
    listening = false;
    if (busRef) {
      busRef.listening = false;
      busRef.energy *= 0.4;
    }
    try {
      proc?.disconnect();
    } catch {
      /* ignore */
    }
    proc = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    void ctx?.close();
    ctx = null;
  }

  function post(pcm: Int16Array, query = "") {
    queue = queue
      .then(async () => {
        const body = await livePost(pcm, query);
        const final = Boolean(body.final) && String(body.text || "").trim();
        if (final) {
          lastText = String(body.text);
          return { kind: "final" as const, text: lastText };
        }
        const partial = String(body.partial || "").trim();
        return { kind: "partial" as const, text: partial };
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : UNSEATED;
        return { kind: "error" as const, text: message };
      });
    return queue as Promise<{ kind: "final" | "partial" | "error"; text: string }>;
  }

  return {
    async load(onProgress) {
      onProgress?.(0.15);
      const probe = await probeFilamentEar();
      if (!probe.seated) {
        throw new Error(probe.error || UNSEATED);
      }
      onProgress?.(1);
    },

    async startLive(bus, hooks) {
      const probe = await probeFilamentEar();
      if (!probe.seated) {
        throw new Error(probe.error || UNSEATED);
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("This browser cannot open a microphone.");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      proc = ctx.createScriptProcessor(4096, 1, 1);
      let carry = new Int16Array(0);
      lastText = "";
      listening = true;
      bus.listening = true;
      bus.processing = false;
      bus.energy = 0;
      busRef = bus;
      proc.onaudioprocess = (ev) => {
        if (!listening || !ctx) return;
        const input = ev.inputBuffer.getChannelData(0);
        bus.energy = energyOf(input);
        const next = pcm16Downsample(input, ctx.sampleRate);
        const merged = new Int16Array(carry.length + next.length);
        merged.set(carry);
        merged.set(next, carry.length);
        let off = 0;
        while (merged.length - off >= LIVE_CHUNK) {
          const chunk = merged.slice(off, off + LIVE_CHUNK);
          off += LIVE_CHUNK;
          void post(chunk).then((got) => {
            if (got.kind === "final" && got.text) hooks.onUtterance(got.text);
            else if (got.kind === "partial") hooks.onPartial(got.text);
          });
        }
        carry = merged.slice(off);
      };
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(proc);
      proc.connect(mute);
      mute.connect(ctx.destination);
      await post(new Int16Array(0), "?reset=1");
    },

    async stopLive() {
      teardown();
      try {
        const got = await post(new Int16Array(0), "?end=1");
        if (got.kind === "final" && got.text) lastText = got.text;
      } catch {
        /* empty ear stays empty */
      }
      return { text: lastText };
    },

    cancelLive() {
      teardown();
      void post(new Int16Array(0), "?end=1").catch(() => undefined);
    },
  };
}

let singleton: FilamentLiveEngine | null = null;

export function getFilamentEngine(): FilamentLiveEngine {
  if (!singleton) singleton = createLiveEar();
  return singleton;
}

export function liveDoor(): { door: number; live: string } {
  return { door: 4850, live: FILAMENT_LIVE };
}
