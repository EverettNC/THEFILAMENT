/** Push spoken tokens into the seated Housing / Field / Live canvases. */

export function setFilamentLive(on: boolean) {
  if (typeof window === "undefined") return;
  window.filamentLive = on;
}

export function tokenizeCatch(text: string): string[] {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function nextCatchTokens(text: string, seen: number): { tokens: string[]; seen: number } {
  const tokens = tokenizeCatch(text);
  if (tokens.length <= seen) return { tokens: [], seen };
  return { tokens: tokens.slice(seen), seen: tokens.length };
}

export function feedFilamentCatch(input: string | { text: string }[]): number {
  if (typeof window === "undefined") return 0;
  if (!window.filamentCatch) return 0;
  const tokens = (typeof input === "string" ? tokenizeCatch(input) : input.map((w) => w.text))
    .map((t) => String(t).trim())
    .filter(Boolean);
  tokens.forEach((tok, i) => {
    window.setTimeout(() => {
      window.filamentCatch?.(tok);
    }, i * 90);
  });
  return tokens.length;
}

export function feedNewCatchTokens(text: string, seen: number): number {
  const next = nextCatchTokens(text, seen);
  if (next.tokens.length) feedFilamentCatch(next.tokens.map((t) => ({ text: t })));
  return next.seen;
}
