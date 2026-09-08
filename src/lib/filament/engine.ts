import { SYLLABLES } from "./syllables";
import type { AudioBus, SttWord } from "./types";

export { getFilamentEngine, type FilamentLiveEngine } from "./live.ts";

type Fiber = {
  a: number;
  len: number;
  curl: number;
  w: number;
  phase: number;
  rate: number;
  charge: number;
};

type Particle = {
  a: number;
  d: number;
  text: string;
  v: number;
  held: boolean;
};

type Label = { x: number; y: number; text: string; life: number };

export type FilamentEngine = {
  destroy: () => void;
  catchText: (text: string, angle?: number) => void;
  feedWords: (words: SttWord[]) => void;
  resetVisualCaught: () => void;
};

export function createFilamentEngine(
  canvas: HTMLCanvasElement,
  audio: AudioBus,
  onCaught: (n: number) => void,
): FilamentEngine {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) {
    return {
      destroy() {},
      catchText() {},
      feedWords() {},
      resetVisualCaught() {},
    };
  }
  const gfx: CanvasRenderingContext2D = ctx;

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0;
  let H = 0;
  let CX = 0;
  let CY = 0;
  let R = 0;
  let DPR = 1;
  let FIL = 2200;
  const fibers: Fiber[] = [];
  const particles: Particle[] = [];
  const labels: Label[] = [];
  let caught = 0;
  let t = 0;
  let raf = 0;
  let alive = true;
  const pending: { text: string; at: number }[] = [];

  function fiberCount() {
    if (reduce) return 480;
    return Math.min(W, H) < 560 ? 780 : 2200;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    gfx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W / 2;
    CY = H / 2;
    R = Math.min(W, H) * 0.42;
    FIL = fiberCount();
    build();
  }

  function build() {
    fibers.length = 0;
    for (let i = 0; i < FIL; i++) {
      const a = Math.random() * Math.PI * 2;
      const len = R * (0.16 + Math.pow(Math.random(), 0.55) * 0.84);
      fibers.push({
        a,
        len,
        curl: (Math.random() - 0.5) * 0.55,
        w: 0.28 + Math.random() * 0.42,
        phase: Math.random() * Math.PI * 2,
        rate: 0.6 + Math.random() * 1.5,
        charge: 0,
      });
    }
  }

  function spawn(forced?: string, angle?: number) {
    const a = angle ?? Math.random() * Math.PI * 2;
    const d = R * (1.02 + Math.random() * 0.22);
    particles.push({
      a,
      d,
      text: forced ?? SYLLABLES[(Math.random() * SYLLABLES.length) | 0]!,
      v: 0.7 + Math.random() * 1.1,
      held: false,
    });
  }

  function chargeNear(angle: number, amount: number) {
    for (const f of fibers) {
      let dd = Math.abs(((f.a - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (dd < 0.22) f.charge = Math.min(1, f.charge + amount * (1 - dd / 0.22));
    }
  }

  function catchText(text: string, angle?: number) {
    const a = angle ?? Math.random() * Math.PI * 2;
    spawn(text, a);
  }

  function feedWords(words: SttWord[]) {
    const now = t;
    for (const w of words) {
      pending.push({ text: w.text, at: now + w.start });
    }
  }

  function resetVisualCaught() {
    caught = 0;
    onCaught(0);
  }

  function tick() {
    if (!alive) return;
    t += 0.016;
    gfx.fillStyle = "rgba(5,7,10,0.30)";
    gfx.fillRect(0, 0, W, H);

    const energy = audio.energy;
    const listening = audio.listening;
    const processing = audio.processing;
    const bins = audio.bins;

    if (bins && listening) {
      const n = bins.length;
      const tau = Math.PI * 2;
      for (const f of fibers) {
        const norm = (((f.a % tau) + tau) % tau) / tau;
        const bin = Math.min(n - 1, Math.floor(norm * n));
        const v = (bins[bin] ?? 0) / 255;
        if (v > 0.18) f.charge = Math.max(f.charge, v * 0.95);
      }
    }

    if (processing) {
      for (let i = 0; i < 18; i++) {
        const f = fibers[(Math.random() * fibers.length) | 0];
        if (f) f.charge = Math.max(f.charge, 0.55 + Math.random() * 0.4);
      }
    }

    gfx.save();
    gfx.strokeStyle = listening
      ? "rgba(127,227,255,0.22)"
      : "rgba(127,227,255,0.13)";
    gfx.setLineDash([2, 7]);
    gfx.lineWidth = 1;
    gfx.beginPath();
    gfx.arc(CX, CY, R, 0, Math.PI * 2);
    gfx.stroke();
    gfx.setLineDash([]);
    gfx.restore();

    for (let i = 0; i < fibers.length; i++) {
      const f = fibers[i]!;
      const pulse = 0.5 + 0.5 * Math.sin(t * f.rate + f.phase);
      const tipA = f.a + f.curl;
      const x1 = CX + Math.cos(f.a) * R * 0.055;
      const y1 = CY + Math.sin(f.a) * R * 0.055;
      const mx = CX + Math.cos(f.a + f.curl * 0.4) * f.len * 0.6;
      const my = CY + Math.sin(f.a + f.curl * 0.4) * f.len * 0.6;
      const x2 = CX + Math.cos(tipA) * f.len;
      const y2 = CY + Math.sin(tipA) * f.len;

      const g = 0.045 + 0.1 * pulse + (listening ? energy * 0.08 : 0);
      gfx.strokeStyle = `rgba(127,227,255,${g})`;
      gfx.lineWidth = f.w;
      f.charge *= 0.8;
      gfx.beginPath();
      gfx.moveTo(x1, y1);
      gfx.quadraticCurveTo(mx, my, x2, y2);
      gfx.stroke();
    }

    const coreR = R * (0.14 + (listening ? energy * 0.04 : 0));
    const cg = gfx.createRadialGradient(CX, CY, 0, CX, CY, coreR);
    if (listening) {
      cg.addColorStop(0, `rgba(223,233,242,${0.22 + energy * 0.08})`);
      cg.addColorStop(0.4, "rgba(127,227,255,0.12)");
    } else if (processing) {
      cg.addColorStop(0, "rgba(223,233,242,0.22)");
      cg.addColorStop(0.4, "rgba(127,227,255,0.12)");
    } else {
      cg.addColorStop(0, "rgba(223,233,242,0.22)");
      cg.addColorStop(0.4, "rgba(127,227,255,0.12)");
    }
    cg.addColorStop(1, "rgba(127,227,255,0)");
    gfx.fillStyle = cg;
    gfx.beginPath();
    gfx.arc(CX, CY, coreR, 0, Math.PI * 2);
    gfx.fill();

    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i]!;
      if (t >= p.at) {
        catchText(p.text);
        pending.splice(i, 1);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const s = particles[i]!;
      s.d -= s.v * (listening ? 1.15 : 1);
      const sx = CX + Math.cos(s.a) * s.d;
      const sy = CY + Math.sin(s.a) * s.d;

      if (!s.held && s.d < R * 0.94) {
        s.held = true;
        caught++;
        onCaught(caught);
        chargeNear(s.a, 1);
        labels.push({ x: sx, y: sy, text: s.text, life: 1 });
      }

      gfx.fillStyle = s.held ? "rgba(138,255,193,0.95)" : "rgba(223,233,242,0.6)";
      gfx.beginPath();
      gfx.arc(sx, sy, s.held ? 2.1 : 1.4, 0, Math.PI * 2);
      gfx.fill();

      if (s.d < R * 0.1) particles.splice(i, 1);
    }

    gfx.font = "11px 'IBM Plex Mono', ui-monospace, Menlo, monospace";
    for (let i = labels.length - 1; i >= 0; i--) {
      const L = labels[i]!;
      L.life -= 0.011;
      L.y -= 0.28;
      if (L.life <= 0) {
        labels.splice(i, 1);
        continue;
      }
      gfx.fillStyle = `rgba(138,255,193,${L.life * 0.85})`;
      gfx.fillText(L.text, L.x + 6, L.y);
    }

    const spawnChance = reduce
      ? 0.03
      : listening
        ? 0.22
        : processing
          ? 0.1
          : 0.16;
    if (Math.random() < spawnChance) spawn();

    raf = requestAnimationFrame(tick);
  }

  const onResize = () => resize();
  window.addEventListener("resize", onResize);
  resize();
  for (let i = 0; i < 14; i++) spawn();
  tick();

  function destroy() {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  }

  return { destroy, catchText, feedWords, resetVisualCaught };
}
