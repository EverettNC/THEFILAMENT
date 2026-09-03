import { createServerFn } from "@tanstack/react-start";
import { KEYTERMS } from "./syllables";
import type { SttWord, TranscribeResult } from "./types";

type TranscribeInput = {
  audioBase64: string;
  mimeType: string;
  filename: string;
  dialect: boolean;
  fillers: boolean;
  diarize: boolean;
};

const MAX_B64 = 7_500_000;

export const transcribeCatch = createServerFn({ method: "POST" })
  .validator((input: TranscribeInput) => input)
  .handler(async ({ data }): Promise<TranscribeResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Transcription isn’t available in this environment." };
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
      return { ok: false, error: "The fibers didn’t catch speech. Try closer to the mic." };
    }

    const form = new FormData();
    form.append("filler_words", data.fillers ? "true" : "false");
    form.append("diarize", data.diarize ? "true" : "false");
    form.append("vad_threshold", "0.35");
    for (const term of KEYTERMS) form.append("keyterm", term);
    const mime = data.mimeType || "application/octet-stream";
    const name = data.filename || "catch.wav";
    const bytes = Uint8Array.from(binary);
    form.append("file", new File([bytes], name, { type: mime }));

    let sttRes: Response;
    try {
      sttRes = await fetch("https://api.x.ai/v1/stt", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch {
      return { ok: false, error: "Could not reach the cochlea. Try again in a moment." };
    }

    if (!sttRes.ok) {
      return { ok: false, error: "The cochlea could not read that catch. Try again." };
    }

    const body = (await sttRes.json()) as {
      text?: string;
      language?: string;
      duration?: number;
      words?: Array<{ text?: string; start?: number; end?: number; speaker?: number }>;
    };

    const rawText = (body.text ?? "").trim();
    if (!rawText) {
      return { ok: false, error: "The fibers didn’t catch speech. Try closer to the mic." };
    }

    const words: SttWord[] = (body.words ?? [])
      .filter((w) => (w.text ?? "").trim())
      .map((w) => ({
        text: String(w.text),
        start: Number(w.start ?? 0),
        end: Number(w.end ?? 0),
        speaker: typeof w.speaker === "number" ? w.speaker : undefined,
      }));

    const base = {
      rawText,
      language: body.language ?? "und",
      duration: Number(body.duration ?? 0),
      words,
    };

    if (!data.dialect) {
      return {
        ok: true,
        text: rawText,
        register: null,
        caught: [],
        ...base,
      };
    }

    const restored = await restoreDialect(apiKey, rawText);
    return {
      ok: true,
      text: restored.text,
      register: restored.register,
      caught: restored.caught,
      ...base,
    };
  });

async function restoreDialect(
  apiKey: string,
  rawText: string,
): Promise<{ text: string; register: string | null; caught: string[] }> {
  const fallback = { text: rawText, register: null as string | null, caught: [] as string[] };
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are PORCH, a super cochlea. You restore speech that generic English ASR flattens.

Rules:
- Do not add or remove propositional content.
- Restore vernacular, dialect, creole, AAVE, Appalachian, Deep South, Cajun, Caribbean, Italian-American, Texan, Slavic particles, East Asian particles, and code-switching.
- Keep y'all, ain't, cain't, fixin', lagniappe, cher, gabagool, irie, likkle, and kin when the evidence supports them.
- Do not "correct" into broadcast English.
- If the transcript is already faithful, return it unchanged.
- Return JSON only: {"text": string, "register": string, "caught": string[]}
- register is a short label for the speech variety, or "neutral".
- caught is distinctive tokens you preserved or restored.`,
          },
          { role: "user", content: rawText.slice(0, 6000) },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = parseJsonObject(content);
    if (!parsed) return fallback;
    const text = typeof parsed.text === "string" && parsed.text.trim() ? parsed.text.trim() : rawText;
    const register =
      typeof parsed.register === "string" && parsed.register && parsed.register !== "neutral"
        ? parsed.register
        : null;
    const caught = Array.isArray(parsed.caught)
      ? parsed.caught.filter((x): x is string => typeof x === "string").slice(0, 40)
      : [];
    return { text, register, caught };
  } catch {
    return fallback;
  }
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const v = JSON.parse(trimmed) as unknown;
    if (v && typeof v === "object") return v as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const v = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
        if (v && typeof v === "object") return v as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}
