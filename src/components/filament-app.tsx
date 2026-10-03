import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Clock3,
  Copy,
  Download,
  Mic,
  Square,
  Upload,
  X,
} from "lucide-react";
import { FilamentCanvas } from "@/components/filament-canvas";
import type { FilamentEngine } from "@/lib/filament/engine";
import { createMic, MAX_SECONDS } from "@/lib/filament/mic";
import { SAMPLE_CATCH } from "@/lib/filament/syllables";
import { transcribeCatch } from "@/lib/filament/stt";
import type {
  AudioBus,
  CatchRecord,
  FieldSettings,
  FieldStatus,
  SttWord,
} from "@/lib/filament/types";
import { blobToBase64 } from "@/lib/filament/wav";
import { cn } from "@/lib/utils";

const HISTORY_KEY = "filament.porch.catches.v1";
const SETTINGS_KEY = "filament.porch.settings.v1";

const DEFAULT_SETTINGS: FieldSettings = {
  dialect: true,
  fillers: false,
  diarize: false,
};

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function FilamentApp() {
  const audioRef = useRef<AudioBus>({
    energy: 0,
    listening: false,
    processing: false,
    bins: null,
  });
  const engineRef = useRef<FilamentEngine | null>(null);
  const micRef = useRef(createMic(audioRef.current));
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number>(0);

  const [status, setStatus] = useState<FieldStatus>("idle");
  const [caught, setCaught] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<CatchRecord | null>(null);
  const [history, setHistory] = useState<CatchRecord[]>([]);
  const [settings, setSettings] = useState<FieldSettings>(DEFAULT_SETTINGS);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHistory(loadJson<CatchRecord[]>(HISTORY_KEY, []));
    setSettings({ ...DEFAULT_SETTINGS, ...loadJson(SETTINGS_KEY, {}) });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 40)));
  }, [history, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  const persistCatch = useCallback((record: CatchRecord) => {
    setActive(record);
    setHistory((prev) => [record, ...prev].slice(0, 40));
    setShowRaw(false);
    setDockOpen(true);
    engineRef.current?.feedWords(record.words);
  }, []);

  const finishAudio = useCallback(
    async (payload: { base64: string; mimeType: string; filename: string }) => {
      setStatus("processing");
      audioRef.current.listening = false;
      audioRef.current.processing = true;
      setError(null);
      try {
        const result = await transcribeCatch({
          data: {
            audioBase64: payload.base64,
            mimeType: payload.mimeType,
            filename: payload.filename,
            dialect: settings.dialect,
            fillers: settings.fillers,
            diarize: settings.diarize,
          },
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        persistCatch({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          at: Date.now(),
          text: result.text,
          rawText: result.rawText,
          register: result.register,
          language: result.language,
          duration: result.duration,
          caught: result.caught,
          words: result.words,
          source: payload.filename === "catch.wav" ? "mic" : "file",
        });
      } catch {
        setError("The cochlea could not be reached. Try again.");
      } finally {
        audioRef.current.processing = false;
        audioRef.current.energy = 0;
        setStatus("idle");
        setElapsed(0);
      }
    },
    [persistCatch, settings],
  );

  const stopListen = useCallback(async () => {
    window.clearInterval(timerRef.current);
    const result = await micRef.current.stop();
    if (!result) {
      audioRef.current.processing = false;
      setStatus("idle");
      setElapsed(0);
      setError("Too short — hold the field open and speak.");
      return;
    }
    await finishAudio({ ...result, filename: "catch.wav" });
  }, [finishAudio]);

  const startListen = useCallback(async () => {
    setError(null);
    setCopied(false);
    setDockOpen(false);
    setHistoryOpen(false);
    try {
      await micRef.current.start();
      setStatus("listening");
      setElapsed(0);
      const t0 = performance.now();
      timerRef.current = window.setInterval(() => {
        const sec = (performance.now() - t0) / 1000;
        setElapsed(sec);
        if (sec >= MAX_SECONDS) void stopListen();
      }, 200);
    } catch {
      setStatus("idle");
      audioRef.current.listening = false;
      setError("Microphone blocked. Allow access, or upload a recording.");
    }
  }, [stopListen]);

  const toggleListen = useCallback(() => {
    if (status === "processing") return;
    if (status === "listening") void stopListen();
    else void startListen();
  }, [status, startListen, stopListen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        toggleListen();
      } else if (e.key === "Escape" && status === "listening") {
        e.preventDefault();
        void stopListen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleListen, stopListen, status]);

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      micRef.current.cancel();
    };
  }, []);

  const runSample = useCallback(() => {
    if (status !== "idle") return;
    setError(null);
    setStatus("processing");
    audioRef.current.processing = true;
    window.setTimeout(() => {
      persistCatch({
        id: `sample-${Date.now()}`,
        at: Date.now(),
        text: SAMPLE_CATCH.text,
        rawText: SAMPLE_CATCH.rawText,
        register: SAMPLE_CATCH.register,
        language: SAMPLE_CATCH.language,
        duration: SAMPLE_CATCH.duration,
        caught: [...SAMPLE_CATCH.caught],
        words: SAMPLE_CATCH.words.map((w) => ({ ...w })),
        source: "sample",
      });
      audioRef.current.processing = false;
      setStatus("idle");
    }, 900);
  }, [persistCatch, status]);

  const onUpload = useCallback(
    async (file: File) => {
      if (status !== "idle") return;
      if (file.size > 8 * 1024 * 1024) {
        setError("Keep uploads under 8 MB.");
        return;
      }
      setError(null);
      const base64 = await blobToBase64(file);
      await finishAudio({
        base64,
        mimeType: file.type || "application/octet-stream",
        filename: file.name || "upload.audio",
      });
    },
    [finishAudio, status],
  );

  const displayText = showRaw && active ? active.rawText : (active?.text ?? "");
  const canToggleRaw = Boolean(active && active.rawText && active.rawText !== active.text);

  const copyText = useCallback(async () => {
    if (!displayText) return;
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Could not copy.");
    }
  }, [displayText]);

  const downloadText = useCallback(() => {
    if (!displayText) return;
    const blob = new Blob([displayText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "filament-catch.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [displayText]);

  const busy = status !== "idle";

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink text-paper">
      <div className="absolute inset-0">
        <FilamentCanvas
          audio={audioRef.current}
          engineRef={engineRef}
          onCaught={setCaught}
        />
      </div>

      <header className="pointer-events-none absolute top-5 left-5 z-10 max-w-md pr-4 md:top-6 md:left-6">
        <p className="font-mono text-2xs text-dim">PORCH · super cochlea</p>
        <h1 className="mt-2 font-mono text-sm font-medium tracking-display text-wire uppercase md:text-base">
          The Filament
        </h1>
        <p className="mt-3 max-w-sm text-pretty font-sans text-sm leading-snug text-dim">
          Millions of micro-fibers. Everything inside fifteen feet has to come
          through them. Every syllable gets grabbed — not just the ones a model was trained on.
        </p>
      </header>

      <div className="absolute top-5 right-5 z-10 flex items-center gap-2 md:top-6 md:right-6">
        <IconBtn
          label={historyOpen ? "Close history" : "Catch history"}
          onClick={() => {
            setHistoryOpen((v) => !v);
            setDockOpen(true);
          }}
        >
          <Clock3 className="size-4" strokeWidth={1.75} />
        </IconBtn>
        <IconBtn
          label="Upload audio"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" strokeWidth={1.75} />
        </IconBtn>
        {hydrated ? (
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onUpload(file);
            }}
          />
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-36 left-5 z-10 font-mono text-2xs leading-relaxed text-dim md:bottom-6 md:left-6 md:text-xs">
        <p className="text-paper">
          radius <span className="tabular-nums text-catch">15 ft</span>
          <span className="mx-2 text-dim">·</span>
          filaments{" "}
          <span className="tabular-nums text-catch">2,200</span>
          <span className="text-dim"> rendered of millions</span>
        </p>
        <p className="mt-1">
          syllables caught{" "}
          <span className="tabular-nums text-catch">{caught.toLocaleString()}</span>
        </p>
        <ul className="mt-3 hidden leading-6 md:block">
          <li>
            <i className="mr-2 inline-block size-2 rounded-full bg-wire align-middle" />
            filament — always blue
          </li>
          <li>
            <i className="mr-2 inline-block size-2 rounded-full align-middle" style={{ background: "#e07040" }} />
            words — cayenne
          </li>
        </ul>
      </div>

      <div className="absolute inset-x-0 bottom-24 z-20 flex flex-col items-center gap-3 md:bottom-8">
        <ListenButton status={status} elapsed={elapsed} onClick={toggleListen} />
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 font-mono text-2xs text-dim">
          <button
            type="button"
            disabled={busy}
            onClick={runSample}
            className="text-wire/80 underline-offset-4 transition-colors duration-150 hover:text-wire hover:underline disabled:opacity-40"
          >
            Sample catch
          </button>
          <span aria-hidden="true">·</span>
          <span>space to listen</span>
          <span aria-hidden="true">·</span>
          <span>Filament ear · local</span>
        </div>
        {error ? (
          <p className="max-w-sm px-4 text-center font-sans text-sm text-hot" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <TranscriptDock
        open={dockOpen}
        onOpenChange={setDockOpen}
        active={active}
        history={history}
        historyOpen={historyOpen}
        settings={settings}
        onSettingsChange={setSettings}
        settingsDisabled={busy}
        onSelectHistory={(item) => {
          setActive(item);
          setHistoryOpen(false);
          setShowRaw(false);
        }}
        displayText={displayText}
        showRaw={showRaw}
        canToggleRaw={canToggleRaw}
        onToggleRaw={() => setShowRaw((v) => !v)}
        copied={copied}
        onCopy={copyText}
        onDownload={downloadText}
        onClearActive={() => setActive(null)}
      />
    </main>
  );
}

function ListenButton({
  status,
  elapsed,
  onClick,
}: {
  status: FieldStatus;
  elapsed: number;
  onClick: () => void;
}) {
  const listening = status === "listening";
  const processing = status === "processing";
  const label = processing ? "Threading" : listening ? "Stop" : "Listen";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={processing}
      aria-pressed={listening}
      className={cn(
        "relative flex size-20 items-center justify-center rounded-full font-mono text-2xs tracking-display uppercase",
        "transition-[transform,box-shadow,background-color,color] duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wire",
        "active:scale-[0.96] disabled:cursor-wait",
        listening
          ? "bg-hot text-ink shadow-hot"
          : processing
            ? "bg-ink-elevated text-hot shadow-hot-soft"
            : "bg-ink-elevated text-wire shadow-wire hover:text-paper",
      )}
    >
      <span
        className={cn("listen-halo", listening ? "border-hot/50" : "border-wire/25")}
        aria-hidden="true"
      />
      <span className="flex flex-col items-center gap-1">
        {processing ? (
          <span className="size-3 rounded-full bg-hot animate-pulse" />
        ) : listening ? (
          <Square className="size-4 fill-current" strokeWidth={1.5} />
        ) : (
          <Mic className="size-4" strokeWidth={1.5} />
        )}
        <span>{listening ? formatClock(elapsed) : label}</span>
      </span>
    </button>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-md bg-ink-elevated text-paper shadow-panel transition-colors duration-150 hover:text-wire disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="font-mono text-2xs text-dim">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={cn(
          "rounded-xs px-1.5 py-0.5 font-mono text-2xs tabular-nums tracking-wide uppercase transition-colors duration-150",
          on ? "text-catch" : "text-dim",
        )}
      >
        {on ? "on" : "off"}
      </button>
    </div>
  );
}

function TranscriptDock({
  open,
  onOpenChange,
  active,
  history,
  historyOpen,
  settings,
  onSettingsChange,
  settingsDisabled,
  onSelectHistory,
  displayText,
  showRaw,
  canToggleRaw,
  onToggleRaw,
  copied,
  onCopy,
  onDownload,
  onClearActive,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  active: CatchRecord | null;
  history: CatchRecord[];
  historyOpen: boolean;
  settings: FieldSettings;
  onSettingsChange: (s: FieldSettings) => void;
  settingsDisabled: boolean;
  onSelectHistory: (item: CatchRecord) => void;
  displayText: string;
  showRaw: boolean;
  canToggleRaw: boolean;
  onToggleRaw: () => void;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onClearActive: () => void;
}) {
  const grouped = useMemo(() => groupBySpeaker(active?.words ?? []), [active]);

  return (
    <aside
      data-open={open ? "true" : "false"}
      className="dock-sheet absolute inset-x-3 bottom-0 z-20 flex flex-col rounded-t-xl bg-ink-elevated shadow-panel md:inset-y-28 md:right-5 md:bottom-28 md:left-auto md:w-80 md:max-h-none md:rounded-xl"
    >
      <button
        type="button"
        className="flex items-center justify-between px-4 py-3 md:hidden"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
      >
        <span className="font-mono text-2xs tracking-display text-dim uppercase">Catch</span>
        <span className="font-mono text-2xs text-wire">{active ? "ready" : "awaiting"}</span>
      </button>

      <div className="hidden items-center justify-between px-4 pt-4 md:flex">
        <p className="font-mono text-2xs tracking-display text-dim uppercase">Catch</p>
        {active ? (
          <button
            type="button"
            onClick={onClearActive}
            className="text-dim transition-colors duration-150 hover:text-paper"
            aria-label="Clear catch"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {historyOpen ? (
          <HistoryList history={history} onSelect={onSelectHistory} />
        ) : active ? (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-2xs text-dim">
              {active.register ? <span className="text-catch">{active.register}</span> : null}
              <span className="tabular-nums">{formatClock(active.duration)}</span>
              {active.language ? <span>{active.language}</span> : null}
              {canToggleRaw ? (
                <button
                  type="button"
                  onClick={onToggleRaw}
                  className="text-wire underline-offset-4 hover:underline"
                >
                  {showRaw ? "Restored catch" : "Raw fiber"}
                </button>
              ) : null}
            </div>
            <div
              className="font-sans text-sm leading-relaxed text-pretty text-paper"
              aria-live="polite"
            >
              {grouped.length > 1 ? (
                grouped.map((g) => (
                  <p key={`${g.speaker}-${g.start}`} className="mb-3">
                    <span className="mb-1 block font-mono text-2xs tracking-wide text-dim uppercase">
                      Speaker {g.speaker + 1}
                    </span>
                    {g.text}
                  </p>
                ))
              ) : (
                <p>{displayText}</p>
              )}
            </div>
            {active.caught.length > 0 && !showRaw ? (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {active.caught.map((token) => (
                  <li
                    key={token}
                    className="rounded-full px-2 py-0.5 font-mono text-2xs text-catch shadow-catch"
                  >
                    {token}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onCopy}
                className="inline-flex h-11 items-center gap-2 rounded-md px-3 font-mono text-2xs tracking-wide text-paper uppercase shadow-paper transition-colors duration-150 hover:text-wire"
              >
                {copied ? (
                  <Check className="size-3.5 text-catch" strokeWidth={2} />
                ) : (
                  <Copy className="size-3.5" strokeWidth={1.75} />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex h-11 items-center gap-2 rounded-md px-3 font-mono text-2xs tracking-wide text-paper uppercase shadow-paper transition-colors duration-150 hover:text-wire"
              >
                <Download className="size-3.5" strokeWidth={1.75} />
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="pt-1 font-sans text-sm leading-relaxed text-pretty text-dim">
            Nothing caught yet. Open the field and speak — creole, Appalachian, kitchen Italian,
            anything the default models shave off. Or run a sample catch.
          </p>
        )}
      </div>

      <fieldset
        disabled={settingsDisabled}
        className="border-t border-hair px-4 py-3"
      >
        <legend className="sr-only">Catch settings</legend>
        <Toggle
          label="Preserve dialect"
          on={settings.dialect}
          onToggle={() => onSettingsChange({ ...settings, dialect: !settings.dialect })}
        />
        <Toggle
          label="Keep fillers"
          on={settings.fillers}
          onToggle={() => onSettingsChange({ ...settings, fillers: !settings.fillers })}
        />
        <Toggle
          label="Mark speakers"
          on={settings.diarize}
          onToggle={() => onSettingsChange({ ...settings, diarize: !settings.diarize })}
        />
      </fieldset>
    </aside>
  );
}

function HistoryList({
  history,
  onSelect,
}: {
  history: CatchRecord[];
  onSelect: (item: CatchRecord) => void;
}) {
  if (history.length === 0) {
    return <p className="font-sans text-sm text-dim">No previous catches.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {history.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="w-full rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-ink"
          >
            <span className="block font-sans text-sm text-paper line-clamp-2">{item.text}</span>
            <span className="mt-1 block font-mono text-2xs text-dim">
              {new Date(item.at).toLocaleString()} · {formatClock(item.duration)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function groupBySpeaker(words: SttWord[]) {
  if (!words.some((w) => typeof w.speaker === "number")) return [];
  const groups: { speaker: number; start: number; text: string }[] = [];
  for (const w of words) {
    const sp = w.speaker ?? 0;
    const last = groups[groups.length - 1];
    if (!last || last.speaker !== sp) {
      groups.push({ speaker: sp, start: w.start, text: w.text });
    } else {
      last.text += ` ${w.text}`;
    }
  }
  return groups;
}
