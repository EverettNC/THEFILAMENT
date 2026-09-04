/** Filament ear. Vosk, offline. Own house. Door 4850. */

import type { SttWord } from "./types";

export const FILAMENT_GITHUB = "https://github.com/EverettNC/THEFILAMENT";
export const FILAMENT_DOOR = 4850;
export const FILAMENT_DEFAULT_EAR = `http://127.0.0.1:${FILAMENT_DOOR}/stt`;
export const FILAMENT_HEALTH = `http://127.0.0.1:${FILAMENT_DOOR}/health`;
export const UNSEATED =
  "Filament ear is unseated. Seat Vosk on :4850 (EverettNC/THEFILAMENT). Empty ear stays empty. No invented speech.";
export const EAR_UNSEATED_FACE =
  "The Filament ear is unseated. Vosk is not sitting on this machine. Empty ear stays empty. No invented speech.";

export function faceEarError(error: string): string {
  if (/unseated|4850|not seated|could not be reached/i.test(error)) return EAR_UNSEATED_FACE;
  return error;
}

export function filamentEarUrl(): string {
  return (process.env.FILAMENT_EAR_URL || process.env.PORCH_EAR_URL || "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function pickText(body: unknown): string | null {
  const rec = asRecord(body);
  if (!rec) return null;
  if (typeof rec.text === "string") return rec.text;
  if (typeof rec.transcript === "string") return rec.transcript;
  if (typeof rec.asSaid === "string") return rec.asSaid;
  return null;
}

export function pickWords(body: unknown): SttWord[] {
  const rec = asRecord(body);
  const words = rec?.words;
  if (!Array.isArray(words)) return [];
  return words
    .map((item) => asRecord(item))
    .filter((w): w is Record<string, unknown> => Boolean(w))
    .filter((w) => typeof w.text === "string" && w.text.trim())
    .map((w) => ({
      text: String(w.text),
      start: Number(w.start ?? 0),
      end: Number(w.end ?? 0),
      speaker: typeof w.speaker === "number" ? w.speaker : undefined,
    }));
}

export async function probeFilamentEar(url = filamentEarUrl()): Promise<{
  seated: boolean;
  ear: string;
  error?: string;
}> {
  const ear = url || FILAMENT_DEFAULT_EAR;
  const health = ear.replace(/\/stt\/?$/, "/health").replace(/\/transcribe\/?$/, "/health");
  try {
    const res = await fetch(health, { method: "GET" });
    const body = (await res.json()) as { seated?: boolean; error?: string };
    if (body.seated) return { seated: true, ear };
    return { seated: false, ear, error: body.error || UNSEATED };
  } catch {
    return { seated: false, ear, error: UNSEATED };
  }
}
