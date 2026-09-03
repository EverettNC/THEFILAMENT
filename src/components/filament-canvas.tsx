import { useEffect, useRef, type MutableRefObject } from "react";
import { createFilamentEngine, type FilamentEngine } from "@/lib/filament/engine";
import type { AudioBus } from "@/lib/filament/types";

type Props = {
  audio: AudioBus;
  onCaught: (n: number) => void;
  engineRef: MutableRefObject<FilamentEngine | null>;
};

export function FilamentCanvas({ audio, onCaught, engineRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const caughtRef = useRef(onCaught);
  caughtRef.current = onCaught;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createFilamentEngine(canvas, audio, (n) => caughtRef.current(n));
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [audio, engineRef]);

  return (
    <canvas
      ref={canvasRef}
      className="block h-full w-full"
      aria-label="Filament field — a super cochlea of micro-fibers"
    />
  );
}
