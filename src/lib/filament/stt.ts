import { createServerFn } from "@tanstack/react-start";
import { KEYTERMS } from "./syllables";
import type { TranscribeResult } from "./types";
import { filamentEarUrl, pickText, pickWords, probeFilamentEar, UNSEATED } from "./ear";

type TranscribeInput = {
  audioBase64: string;
  mimeType: string;
  filename: string;
  dialect: boolean;
  fillers: boolean;
  diarize: boolean;
};

const MAX_B64 = 7_500_000;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function catchFromText(text: string): string[] {
  const lower = text.toLowerCase();
  return KEYTERMS.filter((term) => lower.includes(term.toLowerCase())).slice(0, 40);
}

export const transcribeCatch = createServerFn({ method: "POST" })
  .validator((input: TranscribeInput) => input)
  .handler(async ({ data }): Promise<TranscribeResult> => {
    const probe = await probeFilamentEar(filamentEarUrl());
    if (!probe.seated) {
      return { ok: false, error: probe.error || UNSEATED };
    }
    if (!data.audioBase64 || data.audioBase64.length > MAX_B64) {
      return { ok: false, error: "That catch is too long. Keep it under a minute and a half." };
    }

    let binary: Buffer;
    try {
      binary = Buffer.from(data.audioBase64, "base64");
    } catch {
      return { ok: false, error: "The recording could not be read." };
    }
    if (binary.byteLength < 64) {
      return { ok: false, error: "The fibers did not catch speech. Try closer to the mic." };
    }

    const mime = data.mimeType || "application/octet-stream";
    const name = data.filename || "catch.wav";
    const form = new FormData();
    form.append("filler_words", data.fillers ? "true" : "false");
    form.append("diarize", data.diarize ? "true" : "false");
    form.append("file", new File([Uint8Array.from(binary)], name, { type: mime }));

    let body: unknown;
    try {
      const res = await fetch(probe.ear, { method: "POST", body: form });
      const raw = await res.text();
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        return {
          ok: false,
          error: res.ok ? "The word-ear sent back silence." : `The word-ear failed (${res.status}).`,
        };
      }
      if (!res.ok) {
        const rec = asRecord(body);
        const err = rec && typeof rec.error === "string" ? rec.error : `The word-ear failed (${res.status}).`;
        return { ok: false, error: err };
      }
    } catch {
      return { ok: false, error: "The local word-ear could not be reached." };
    }

    const rawText = (pickText(body) ?? "").trim();
    if (!rawText) {
      return { ok: false, error: "The fibers did not catch speech. Empty ear stays empty." };
    }

    const words = pickWords(body);
    const rec = asRecord(body);
    const duration =
      rec && typeof rec.duration === "number" && Number.isFinite(rec.duration) ? rec.duration : 0;
    const language = rec && typeof rec.language === "string" ? rec.language : "und";
    const caught = data.dialect ? catchFromText(rawText) : [];

    return {
      ok: true,
      text: rawText,
      rawText,
      language,
      duration,
      words,
      register: rec && rec.engine === "vosk" ? "vosk" : null,
      caught,
    };
  });
