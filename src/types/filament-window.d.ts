export {};

declare global {
  interface Window {
    filamentCatch?: (text: string) => void;
    filamentLive?: boolean;
    filamentStats?: { caught: number; slipped: number; pct: number; total: number };
  }
}
