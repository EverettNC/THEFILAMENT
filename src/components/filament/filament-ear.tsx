import { useEffect, useRef, useState } from "react";
import { FILAMENT_VIEWS, type FilamentView } from "@/components/filament/filament-stage";
import { feedFilamentCatch, feedNewCatchTokens, setFilamentLive } from "@/lib/filament/catch";
import { nextDialectStim } from "@/lib/filament/syllables";
import type { FilamentEngine } from "@/lib/filament/engine";
import type { AudioBus } from "@/lib/filament/types";
import { cn } from "@/lib/utils";

type Phase = "seating" | "ready" | "hearing" | "denied" | "failed";
type Stats = { caught: number; slipped: number; pct: number; total: number };

const MIC_DENIED = "mic denied";
const EMPTY_STATS: Stats = { caught: 0, slipped: 0, pct: 0, total: 0 };

async function filament(): Promise<FilamentEngine> {
  const { getFilamentEngine } = await import("@/lib/filament/engine");
  return getFilamentEngine();
}

function emptyBus(): AudioBus {
  return { energy: 0, listening: false, processing: false, bins: null };
}

export function FilamentEar({
  view,
  onView,
}: {
  view: FilamentView;
  onView: (view: FilamentView) => void;
}) {
  const [phase, setPhase] = useState<Phase>("seating");
  const [note, setNote] = useState("filament live · training");
  const [said, setSaid] = useState("");
  const [partial, setPartial] = useState("");
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  const engineRef = useRef<FilamentEngine | null>(null);
  const busRef = useRef<AudioBus>(emptyBus());
  const seenRef = useRef(0);
  const finalsRef = useRef<string[]>([]);
  const phaseRef = useRef(phase);
  const queueRef = useRef<string[]>([]);
  const regionRef = useRef("louisiana creole");
  phaseRef.current = phase;

  useEffect(() => {
    let live = true;
    void filament()
      .then((engine) =>
        engine
          .load((ratio) => {
            if (!live) return;
            if (ratio > 0 && ratio < 1) setNote(`seating ${Math.round(ratio * 100)}% · training`);
          })
          .then(() => engine),
      )
      .then((engine) => {
        if (!live) return;
        engineRef.current = engine;
        setPhase("ready");
      })
      .catch((err: unknown) => {
        if (!live) return;
        setPhase("failed");
        setNote(err instanceof Error ? err.message : "unseated");
      });
    return () => {
      live = false;
      setFilamentLive(false);
      engineRef.current?.cancelLive();
    };
  }, []);

  useEffect(() => {
    if (phase === "hearing") setFilamentLive(true);
  }, [view, phase]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = window.filamentStats;
      if (next) setStats({ ...next });
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (phase === "hearing" || phase === "failed") return;
    const kick = () => {
      if (phaseRef.current === "hearing") return;
      if (!queueRef.current.length) {
        const pack = nextDialectStim();
        queueRef.current = [...pack.tokens];
        regionRef.current = pack.label.toLowerCase();
      }
      const tok = queueRef.current.shift();
      if (!tok) return;
      feedFilamentCatch([{ text: tok }]);
      setSaid(tok);
      setPartial("");
      setNote(`training · ${regionRef.current}`);
    };
    const start = window.setTimeout(kick, 600);
    const id = window.setInterval(kick, 900);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [phase, view]);

  async function start() {
    const engine = engineRef.current;
    if (!engine || phaseRef.current === "hearing") return;
    seenRef.current = 0;
    finalsRef.current = [];
    setSaid("");
    setPartial("");
    setFilamentLive(true);
    try {
      await engine.startLive(busRef.current, {
        onPartial: (text) => {
          setPartial(text);
          seenRef.current = feedNewCatchTokens(text, seenRef.current);
        },
        onUtterance: (text) => {
          seenRef.current = feedNewCatchTokens(text, seenRef.current);
          seenRef.current = 0;
          finalsRef.current = [...finalsRef.current, text].filter(Boolean).slice(-12);
          setSaid(finalsRef.current.join(" "));
          setPartial("");
        },
      });
      setPhase("hearing");
      setNote("hearing");
    } catch {
      setFilamentLive(false);
      setPhase("denied");
      setNote(MIC_DENIED);
    }
  }

  async function stop() {
    const engine = engineRef.current;
    setFilamentLive(false);
    if (!engine) {
      setPhase("ready");
      return;
    }
    const result = await engine.stopLive();
    if (result.text.trim()) {
      seenRef.current = feedNewCatchTokens(result.text, seenRef.current);
      finalsRef.current = [...finalsRef.current, result.text].filter(Boolean).slice(-12);
      setSaid(finalsRef.current.join(" "));
    }
    seenRef.current = 0;
    setPartial("");
    setPhase("ready");
  }

  const hearing = phase === "hearing";
  const busy = phase === "seating";
  const accent =
    view === "housing" ? "border-tiff text-tiff" : view === "live" ? "border-catch text-catch" : "border-wire text-wire";

  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-mono text-paper">
      <div className="pointer-events-auto absolute top-6 right-6 flex max-w-xs flex-col items-end gap-3">
        <nav aria-label="Filament view" className="flex gap-3 text-xs tracking-widest uppercase">
          {(Object.keys(FILAMENT_VIEWS) as FilamentView[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-current={view === key ? "page" : undefined}
              onClick={() => onView(key)}
              className={cn(
                "min-h-11 px-1 text-dim transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:text-paper",
                view === key && (key === "housing" ? "text-tiff" : key === "live" ? "text-catch" : "text-wire"),
              )}
            >
              {FILAMENT_VIEWS[key].label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          aria-pressed={hearing}
          disabled={busy || phase === "failed"}
          onClick={() => {
            void (hearing ? stop() : start());
          }}
          className={cn(
            "min-h-11 border bg-transparent px-4 text-xs tracking-widest uppercase transition-[opacity,transform] duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:opacity-90 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-35",
            accent,
          )}
        >
          {busy ? "Hold" : hearing ? "Stop" : "Listen"}
        </button>
        <p className="max-w-full text-right text-xs text-hot" aria-live="polite">
          caught {stats.caught.toLocaleString()} · slipped {stats.slipped.toLocaleString()} · {stats.total ? `${stats.pct}%` : "—"}
        </p>
        <p
          className={cn(
            "max-w-full text-right text-xs text-dim",
            (hearing || phase === "ready" || phase === "seating") &&
              (view === "housing" ? "text-tiff" : view === "live" ? "text-catch" : "text-wire"),
            phase === "failed" || phase === "denied" ? "text-danger" : null,
          )}
          aria-live="polite"
        >
          {note}
        </p>
      </div>

      {(said || partial) && (
        <p
          className="pointer-events-none absolute bottom-24 left-6 right-6 max-w-3xl text-sm text-pretty text-hot"
          aria-live="polite"
        >
          {said}
          {partial ? (
            <span className="italic text-hot">
              {said ? " " : ""}
              {partial}
            </span>
          ) : null}
        </p>
      )}
    </div>
  );
}
