import { i as __toESM } from "../_runtime.mjs";
import { R as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Mic, c as Clock3, i as Square, l as Check, n as Upload, o as Download, s as Copy, t as X } from "../_libs/lucide-react.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { n as SAMPLE_CATCH, r as SYLLABLES } from "./syllables-BW1TFAo8.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-cviSMgF3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function createFilamentEngine(canvas, audio, onCaught) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return {
		destroy() {},
		catchText() {},
		feedWords() {},
		resetVisualCaught() {}
	};
	const gfx = ctx;
	const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	let W = 0;
	let H = 0;
	let CX = 0;
	let CY = 0;
	let R = 0;
	let DPR = 1;
	let FIL = 2200;
	const fibers = [];
	const particles = [];
	const labels = [];
	let caught = 0;
	let t = 0;
	let raf = 0;
	let alive = true;
	const pending = [];
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
		R = Math.min(W, H) * .42;
		FIL = fiberCount();
		build();
	}
	function build() {
		fibers.length = 0;
		for (let i = 0; i < FIL; i++) {
			const a = Math.random() * Math.PI * 2;
			const len = R * (.16 + Math.pow(Math.random(), .55) * .84);
			fibers.push({
				a,
				len,
				curl: (Math.random() - .5) * .55,
				w: .28 + Math.random() * .42,
				phase: Math.random() * Math.PI * 2,
				rate: .6 + Math.random() * 1.5,
				charge: 0
			});
		}
	}
	function spawn(forced, angle) {
		const a = angle ?? Math.random() * Math.PI * 2;
		const d = R * (1.02 + Math.random() * .22);
		particles.push({
			a,
			d,
			text: forced ?? SYLLABLES[Math.random() * SYLLABLES.length | 0],
			v: .7 + Math.random() * 1.1,
			held: false
		});
	}
	function chargeNear(angle, amount) {
		for (const f of fibers) {
			let dd = Math.abs((f.a - angle + Math.PI * 3) % (Math.PI * 2) - Math.PI);
			if (dd < .22) f.charge = Math.min(1, f.charge + amount * (1 - dd / .22));
		}
	}
	function catchText(text, angle) {
		spawn(text, angle ?? Math.random() * Math.PI * 2);
	}
	function feedWords(words) {
		const now = t;
		for (const w of words) pending.push({
			text: w.text,
			at: now + w.start
		});
	}
	function resetVisualCaught() {
		caught = 0;
		onCaught(0);
	}
	function tick() {
		if (!alive) return;
		t += .016;
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
				const norm = (f.a % tau + tau) % tau / tau;
				const v = (bins[Math.min(n - 1, Math.floor(norm * n))] ?? 0) / 255;
				if (v > .18) f.charge = Math.max(f.charge, v * .95);
			}
		}
		if (processing) for (let i = 0; i < 18; i++) {
			const f = fibers[Math.random() * fibers.length | 0];
			if (f) f.charge = Math.max(f.charge, .55 + Math.random() * .4);
		}
		gfx.save();
		gfx.strokeStyle = listening ? "rgba(255,208,138,0.28)" : "rgba(127,227,255,0.13)";
		gfx.setLineDash([2, 7]);
		gfx.lineWidth = 1;
		gfx.beginPath();
		gfx.arc(CX, CY, R, 0, Math.PI * 2);
		gfx.stroke();
		gfx.setLineDash([]);
		gfx.restore();
		for (let i = 0; i < fibers.length; i++) {
			const f = fibers[i];
			const pulse = .5 + .5 * Math.sin(t * f.rate + f.phase);
			const tipA = f.a + f.curl;
			const x1 = CX + Math.cos(f.a) * R * .055;
			const y1 = CY + Math.sin(f.a) * R * .055;
			const mx = CX + Math.cos(f.a + f.curl * .4) * f.len * .6;
			const my = CY + Math.sin(f.a + f.curl * .4) * f.len * .6;
			const x2 = CX + Math.cos(tipA) * f.len;
			const y2 = CY + Math.sin(tipA) * f.len;
			if (f.charge > .01) {
				gfx.strokeStyle = `rgba(255,208,138,${.3 + .55 * f.charge})`;
				gfx.lineWidth = f.w + 1.5 * f.charge;
				f.charge *= .93;
			} else {
				const g = .045 + .1 * pulse + (listening ? energy * .12 : 0);
				gfx.strokeStyle = `rgba(127,227,255,${g})`;
				gfx.lineWidth = f.w;
			}
			gfx.beginPath();
			gfx.moveTo(x1, y1);
			gfx.quadraticCurveTo(mx, my, x2, y2);
			gfx.stroke();
		}
		const coreR = R * (.14 + (listening ? energy * .04 : 0));
		const cg = gfx.createRadialGradient(CX, CY, 0, CX, CY, coreR);
		if (listening) {
			cg.addColorStop(0, `rgba(255,240,210,${.55 + energy * .35})`);
			cg.addColorStop(.4, "rgba(255,208,138,0.22)");
		} else if (processing) {
			cg.addColorStop(0, "rgba(255,208,138,0.62)");
			cg.addColorStop(.4, "rgba(127,227,255,0.18)");
		} else {
			cg.addColorStop(0, "rgba(255,240,210,0.55)");
			cg.addColorStop(.4, "rgba(127,227,255,0.16)");
		}
		cg.addColorStop(1, "rgba(127,227,255,0)");
		gfx.fillStyle = cg;
		gfx.beginPath();
		gfx.arc(CX, CY, coreR, 0, Math.PI * 2);
		gfx.fill();
		for (let i = pending.length - 1; i >= 0; i--) {
			const p = pending[i];
			if (t >= p.at) {
				catchText(p.text);
				pending.splice(i, 1);
			}
		}
		for (let i = particles.length - 1; i >= 0; i--) {
			const s = particles[i];
			s.d -= s.v * (listening ? 1.15 : 1);
			const sx = CX + Math.cos(s.a) * s.d;
			const sy = CY + Math.sin(s.a) * s.d;
			if (!s.held && s.d < R * .94) {
				s.held = true;
				caught++;
				onCaught(caught);
				chargeNear(s.a, 1);
				labels.push({
					x: sx,
					y: sy,
					text: s.text,
					life: 1
				});
			}
			gfx.fillStyle = s.held ? "rgba(138,255,193,0.95)" : "rgba(223,233,242,0.6)";
			gfx.beginPath();
			gfx.arc(sx, sy, s.held ? 2.1 : 1.4, 0, Math.PI * 2);
			gfx.fill();
			if (s.d < R * .1) particles.splice(i, 1);
		}
		gfx.font = "11px 'IBM Plex Mono', ui-monospace, Menlo, monospace";
		for (let i = labels.length - 1; i >= 0; i--) {
			const L = labels[i];
			L.life -= .011;
			L.y -= .28;
			if (L.life <= 0) {
				labels.splice(i, 1);
				continue;
			}
			gfx.fillStyle = `rgba(138,255,193,${L.life * .85})`;
			gfx.fillText(L.text, L.x + 6, L.y);
		}
		if (Math.random() < (reduce ? .03 : listening ? .22 : processing ? .1 : .16)) spawn();
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
	return {
		destroy,
		catchText,
		feedWords,
		resetVisualCaught
	};
}
function FilamentCanvas({ audio, onCaught, engineRef }) {
	const canvasRef = (0, import_react.useRef)(null);
	const caughtRef = (0, import_react.useRef)(onCaught);
	caughtRef.current = onCaught;
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const engine = createFilamentEngine(canvas, audio, (n) => caughtRef.current(n));
		engineRef.current = engine;
		return () => {
			engine.destroy();
			engineRef.current = null;
		};
	}, [audio, engineRef]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		className: "block h-full w-full",
		"aria-label": "Filament field — a super cochlea of micro-fibers"
	});
}
function concatFloat32(chunks) {
	let n = 0;
	for (const c of chunks) n += c.length;
	const out = new Float32Array(n);
	let o = 0;
	for (const c of chunks) {
		out.set(c, o);
		o += c.length;
	}
	return out;
}
function downsample(input, inRate, outRate) {
	if (outRate >= inRate) return input;
	const ratio = inRate / outRate;
	const outLen = Math.floor(input.length / ratio);
	const out = new Float32Array(outLen);
	for (let i = 0; i < outLen; i++) {
		const start = Math.floor(i * ratio);
		const end = Math.min(input.length, Math.floor((i + 1) * ratio));
		let sum = 0;
		let count = 0;
		for (let j = start; j < end; j++) {
			sum += input[j] ?? 0;
			count++;
		}
		out[i] = count ? sum / count : 0;
	}
	return out;
}
function encodeWav(samples, sampleRate) {
	const buffer = /* @__PURE__ */ new ArrayBuffer(44 + samples.length * 2);
	const view = new DataView(buffer);
	writeStr(view, 0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	writeStr(view, 8, "WAVE");
	writeStr(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeStr(view, 36, "data");
	view.setUint32(40, samples.length * 2, true);
	let offset = 44;
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
		view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true);
		offset += 2;
	}
	return buffer;
}
function writeStr(view, offset, str) {
	for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
function blobToBase64(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const s = String(reader.result ?? "");
			const i = s.indexOf(",");
			resolve(i >= 0 ? s.slice(i + 1) : s);
		};
		reader.onerror = () => reject(reader.error ?? /* @__PURE__ */ new Error("read failed"));
		reader.readAsDataURL(blob);
	});
}
var TARGET_RATE = 16e3;
function createMic(audio) {
	let stream = null;
	let ctx = null;
	let processor = null;
	let analyser = null;
	let raf = 0;
	let chunks = [];
	let startedAt = 0;
	let running = false;
	function pumpMeters() {
		if (!analyser || !running) return;
		const bins = audio.bins ?? new Uint8Array(analyser.frequencyBinCount);
		if (!audio.bins) audio.bins = bins;
		analyser.getByteFrequencyData(bins);
		let sum = 0;
		for (let i = 0; i < bins.length; i++) sum += bins[i] ?? 0;
		const avg = sum / (bins.length * 255);
		audio.energy = Math.min(1, avg * 3.2);
		raf = requestAnimationFrame(pumpMeters);
	}
	async function start() {
		if (running) return;
		if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot open a microphone.");
		stream = await navigator.mediaDevices.getUserMedia({ audio: {
			echoCancellation: true,
			noiseSuppression: true,
			channelCount: 1
		} });
		ctx = new (window.AudioContext || window.webkitAudioContext)();
		await ctx.resume();
		const source = ctx.createMediaStreamSource(stream);
		analyser = ctx.createAnalyser();
		analyser.fftSize = 1024;
		analyser.smoothingTimeConstant = .72;
		source.connect(analyser);
		processor = ctx.createScriptProcessor(4096, 1, 1);
		processor.onaudioprocess = (ev) => {
			if (!running) return;
			const input = ev.inputBuffer.getChannelData(0);
			chunks.push(new Float32Array(input));
		};
		const mute = ctx.createGain();
		mute.gain.value = 0;
		source.connect(processor);
		processor.connect(mute);
		mute.connect(ctx.destination);
		chunks = [];
		startedAt = performance.now();
		running = true;
		audio.listening = true;
		audio.processing = false;
		audio.energy = 0;
		pumpMeters();
	}
	function teardown() {
		running = false;
		audio.listening = false;
		audio.energy *= .4;
		cancelAnimationFrame(raf);
		try {
			processor?.disconnect();
		} catch {}
		processor = null;
		try {
			analyser?.disconnect();
		} catch {}
		analyser = null;
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		ctx?.close();
		ctx = null;
	}
	async function stop() {
		if (!running) return null;
		const duration = (performance.now() - startedAt) / 1e3;
		const nativeRate = ctx?.sampleRate ?? TARGET_RATE;
		const captured = chunks;
		teardown();
		if (duration < .35 || captured.length === 0) return null;
		const wav = encodeWav(downsample(concatFloat32(captured), nativeRate, TARGET_RATE), TARGET_RATE);
		return {
			base64: await blobToBase64(new Blob([wav], { type: "audio/wav" })),
			mimeType: "audio/wav",
			duration
		};
	}
	function cancel() {
		chunks = [];
		teardown();
	}
	return {
		start,
		stop,
		cancel
	};
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var transcribeCatch = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("2aa5d4b67d12e3fb120afabbf3a7d55d8bc14910f51f2e95c910472d3c7b6a6b"));
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var HISTORY_KEY = "filament.porch.catches.v1";
var SETTINGS_KEY = "filament.porch.settings.v1";
var DEFAULT_SETTINGS = {
	dialect: true,
	fillers: false,
	diarize: false
};
function loadJson(key, fallback) {
	if (typeof window === "undefined") return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch {
		return fallback;
	}
}
function formatClock(seconds) {
	const s = Math.max(0, Math.floor(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function FilamentApp() {
	const audioRef = (0, import_react.useRef)({
		energy: 0,
		listening: false,
		processing: false,
		bins: null
	});
	const engineRef = (0, import_react.useRef)(null);
	const micRef = (0, import_react.useRef)(createMic(audioRef.current));
	const fileRef = (0, import_react.useRef)(null);
	const timerRef = (0, import_react.useRef)(0);
	const [status, setStatus] = (0, import_react.useState)("idle");
	const [caught, setCaught] = (0, import_react.useState)(0);
	const [elapsed, setElapsed] = (0, import_react.useState)(0);
	const [error, setError] = (0, import_react.useState)(null);
	const [active, setActive] = (0, import_react.useState)(null);
	const [history, setHistory] = (0, import_react.useState)([]);
	const [settings, setSettings] = (0, import_react.useState)(DEFAULT_SETTINGS);
	const [showRaw, setShowRaw] = (0, import_react.useState)(false);
	const [copied, setCopied] = (0, import_react.useState)(false);
	const [historyOpen, setHistoryOpen] = (0, import_react.useState)(false);
	const [dockOpen, setDockOpen] = (0, import_react.useState)(false);
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setHistory(loadJson(HISTORY_KEY, []));
		setSettings({
			...DEFAULT_SETTINGS,
			...loadJson(SETTINGS_KEY, {})
		});
		setHydrated(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 40)));
	}, [history, hydrated]);
	(0, import_react.useEffect)(() => {
		if (!hydrated) return;
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
	}, [settings, hydrated]);
	const persistCatch = (0, import_react.useCallback)((record) => {
		setActive(record);
		setHistory((prev) => [record, ...prev].slice(0, 40));
		setShowRaw(false);
		setDockOpen(true);
		engineRef.current?.feedWords(record.words);
	}, []);
	const finishAudio = (0, import_react.useCallback)(async (payload) => {
		setStatus("processing");
		audioRef.current.listening = false;
		audioRef.current.processing = true;
		setError(null);
		try {
			const result = await transcribeCatch({ data: {
				audioBase64: payload.base64,
				mimeType: payload.mimeType,
				filename: payload.filename,
				dialect: settings.dialect,
				fillers: settings.fillers,
				diarize: settings.diarize
			} });
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
				source: payload.filename === "catch.wav" ? "mic" : "file"
			});
		} catch {
			setError("The cochlea could not be reached. Try again.");
		} finally {
			audioRef.current.processing = false;
			audioRef.current.energy = 0;
			setStatus("idle");
			setElapsed(0);
		}
	}, [persistCatch, settings]);
	const stopListen = (0, import_react.useCallback)(async () => {
		window.clearInterval(timerRef.current);
		const result = await micRef.current.stop();
		if (!result) {
			audioRef.current.processing = false;
			setStatus("idle");
			setElapsed(0);
			setError("Too short — hold the field open and speak.");
			return;
		}
		await finishAudio({
			...result,
			filename: "catch.wav"
		});
	}, [finishAudio]);
	const startListen = (0, import_react.useCallback)(async () => {
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
				const sec = (performance.now() - t0) / 1e3;
				setElapsed(sec);
				if (sec >= 90) stopListen();
			}, 200);
		} catch {
			setStatus("idle");
			audioRef.current.listening = false;
			setError("Microphone blocked. Allow access, or upload a recording.");
		}
	}, [stopListen]);
	const toggleListen = (0, import_react.useCallback)(() => {
		if (status === "processing") return;
		if (status === "listening") stopListen();
		else startListen();
	}, [
		status,
		startListen,
		stopListen
	]);
	(0, import_react.useEffect)(() => {
		function onKey(e) {
			const tag = e.target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			if (e.code === "Space") {
				e.preventDefault();
				toggleListen();
			} else if (e.key === "Escape" && status === "listening") {
				e.preventDefault();
				stopListen();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		toggleListen,
		stopListen,
		status
	]);
	(0, import_react.useEffect)(() => {
		return () => {
			window.clearInterval(timerRef.current);
			micRef.current.cancel();
		};
	}, []);
	const runSample = (0, import_react.useCallback)(() => {
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
				source: "sample"
			});
			audioRef.current.processing = false;
			setStatus("idle");
		}, 900);
	}, [persistCatch, status]);
	const onUpload = (0, import_react.useCallback)(async (file) => {
		if (status !== "idle") return;
		if (file.size > 8388608) {
			setError("Keep uploads under 8 MB.");
			return;
		}
		setError(null);
		const base64 = await blobToBase64(file);
		await finishAudio({
			base64,
			mimeType: file.type || "application/octet-stream",
			filename: file.name || "upload.audio"
		});
	}, [finishAudio, status]);
	const displayText = showRaw && active ? active.rawText : active?.text ?? "";
	const canToggleRaw = Boolean(active && active.rawText && active.rawText !== active.text);
	const copyText = (0, import_react.useCallback)(async () => {
		if (!displayText) return;
		try {
			await navigator.clipboard.writeText(displayText);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1400);
		} catch {
			setError("Could not copy.");
		}
	}, [displayText]);
	const downloadText = (0, import_react.useCallback)(() => {
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "relative h-dvh w-full overflow-hidden bg-ink text-paper",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilamentCanvas, {
					audio: audioRef.current,
					engineRef,
					onCaught: setCaught
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "pointer-events-none absolute top-5 left-5 z-10 max-w-md pr-4 md:top-6 md:left-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-2xs text-dim",
						children: "PORCH · super cochlea"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 font-mono text-sm font-medium tracking-display text-wire uppercase md:text-base",
						children: "The Filament"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 max-w-sm text-pretty font-sans text-sm leading-snug text-dim",
						children: "Millions of micro-fibers, electrified. Everything inside fifteen feet has to come through them. Every syllable gets grabbed — not just the ones a model was trained on."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute top-5 right-5 z-10 flex items-center gap-2 md:top-6 md:right-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
						label: historyOpen ? "Close history" : "Catch history",
						onClick: () => {
							setHistoryOpen((v) => !v);
							setDockOpen(true);
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock3, {
							className: "size-4",
							strokeWidth: 1.75
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconBtn, {
						label: "Upload audio",
						disabled: busy,
						onClick: () => fileRef.current?.click(),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
							className: "size-4",
							strokeWidth: 1.75
						})
					}),
					hydrated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: fileRef,
						type: "file",
						accept: "audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm",
						className: "sr-only",
						tabIndex: -1,
						"aria-hidden": "true",
						onChange: (e) => {
							const file = e.target.files?.[0];
							e.target.value = "";
							if (file) onUpload(file);
						}
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute bottom-36 left-5 z-10 font-mono text-2xs leading-relaxed text-dim md:bottom-6 md:left-6 md:text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-paper",
						children: [
							"radius ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular-nums text-catch",
								children: "15 ft"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mx-2 text-dim",
								children: "·"
							}),
							"filaments",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular-nums text-catch",
								children: "2,200"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-dim",
								children: " rendered of millions"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1",
						children: [
							"syllables caught",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular-nums text-catch",
								children: caught.toLocaleString()
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "mt-3 hidden leading-6 md:block",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "mr-2 inline-block size-2 rounded-full bg-wire align-middle" }), "filament at rest"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "mr-2 inline-block size-2 rounded-full bg-hot align-middle" }), "electrified — carrying charge"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", { className: "mr-2 inline-block size-2 rounded-full bg-catch align-middle" }), "syllable grabbed"] })
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute inset-x-0 bottom-24 z-20 flex flex-col items-center gap-3 md:bottom-8",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListenButton, {
						status,
						elapsed,
						onClick: toggleListen
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 font-mono text-2xs text-dim",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: busy,
								onClick: runSample,
								className: "text-wire/80 underline-offset-4 transition-colors duration-150 hover:text-wire hover:underline disabled:opacity-40",
								children: "Sample catch"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								children: "·"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "space to listen" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								children: "·"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Grok STT" })
						]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-sm px-4 text-center font-sans text-sm text-hot",
						role: "alert",
						children: error
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TranscriptDock, {
				open: dockOpen,
				onOpenChange: setDockOpen,
				active,
				history,
				historyOpen,
				settings,
				onSettingsChange: setSettings,
				settingsDisabled: busy,
				onSelectHistory: (item) => {
					setActive(item);
					setHistoryOpen(false);
					setShowRaw(false);
				},
				displayText,
				showRaw,
				canToggleRaw,
				onToggleRaw: () => setShowRaw((v) => !v),
				copied,
				onCopy: copyText,
				onDownload: downloadText,
				onClearActive: () => setActive(null)
			})
		]
	});
}
function ListenButton({ status, elapsed, onClick }) {
	const listening = status === "listening";
	const processing = status === "processing";
	const label = processing ? "Threading" : listening ? "Stop" : "Listen";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		disabled: processing,
		"aria-pressed": listening,
		className: cn("relative flex size-20 items-center justify-center rounded-full font-mono text-2xs tracking-display uppercase", "transition-[transform,box-shadow,background-color,color] duration-150 ease-out", "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-wire", "active:scale-[0.96] disabled:cursor-wait", listening ? "bg-hot text-ink shadow-hot" : processing ? "bg-ink-elevated text-hot shadow-hot-soft" : "bg-ink-elevated text-wire shadow-wire hover:text-paper"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: cn("listen-halo", listening ? "border-hot/50" : "border-wire/25"),
			"aria-hidden": "true"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex flex-col items-center gap-1",
			children: [processing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-3 rounded-full bg-hot animate-pulse" }) : listening ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
				className: "size-4 fill-current",
				strokeWidth: 1.5
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mic, {
				className: "size-4",
				strokeWidth: 1.5
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: listening ? formatClock(elapsed) : label })]
		})]
	});
}
function IconBtn({ label, children, onClick, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		title: label,
		"aria-label": label,
		disabled,
		onClick,
		className: "flex size-11 items-center justify-center rounded-md bg-ink-elevated text-paper shadow-panel transition-colors duration-150 hover:text-wire disabled:opacity-40",
		children
	});
}
function Toggle({ label, on, onToggle }) {
	const id = (0, import_react.useId)();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
			htmlFor: id,
			className: "font-mono text-2xs text-dim",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			id,
			type: "button",
			role: "switch",
			"aria-checked": on,
			onClick: onToggle,
			className: cn("rounded-xs px-1.5 py-0.5 font-mono text-2xs tabular-nums tracking-wide uppercase transition-colors duration-150", on ? "text-catch" : "text-dim"),
			children: on ? "on" : "off"
		})]
	});
}
function TranscriptDock({ open, onOpenChange, active, history, historyOpen, settings, onSettingsChange, settingsDisabled, onSelectHistory, displayText, showRaw, canToggleRaw, onToggleRaw, copied, onCopy, onDownload, onClearActive }) {
	const grouped = (0, import_react.useMemo)(() => groupBySpeaker(active?.words ?? []), [active]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		"data-open": open ? "true" : "false",
		className: "dock-sheet absolute inset-x-3 bottom-0 z-20 flex flex-col rounded-t-xl bg-ink-elevated shadow-panel md:inset-y-28 md:right-5 md:bottom-28 md:left-auto md:w-80 md:max-h-none md:rounded-xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "flex items-center justify-between px-4 py-3 md:hidden",
				onClick: () => onOpenChange(!open),
				"aria-expanded": open,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-2xs tracking-display text-dim uppercase",
					children: "Catch"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-2xs text-wire",
					children: active ? "ready" : "awaiting"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "hidden items-center justify-between px-4 pt-4 md:flex",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-2xs tracking-display text-dim uppercase",
					children: "Catch"
				}), active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClearActive,
					className: "text-dim transition-colors duration-150 hover:text-paper",
					"aria-label": "Clear catch",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
						className: "size-4",
						strokeWidth: 1.75
					})
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "min-h-0 flex-1 overflow-y-auto px-4 pb-3",
				children: historyOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HistoryList, {
					history,
					onSelect: onSelectHistory
				}) : active ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex flex-wrap items-center gap-2 font-mono text-2xs text-dim",
						children: [
							active.register ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-catch",
								children: active.register
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular-nums",
								children: formatClock(active.duration)
							}),
							active.language ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: active.language }) : null,
							canToggleRaw ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: onToggleRaw,
								className: "text-wire underline-offset-4 hover:underline",
								children: showRaw ? "Restored catch" : "Raw fiber"
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-sans text-sm leading-relaxed text-pretty text-paper",
						"aria-live": "polite",
						children: grouped.length > 1 ? grouped.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mb-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mb-1 block font-mono text-2xs tracking-wide text-dim uppercase",
								children: ["Speaker ", g.speaker + 1]
							}), g.text]
						}, `${g.speaker}-${g.start}`)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: displayText })
					}),
					active.caught.length > 0 && !showRaw ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-4 flex flex-wrap gap-1.5",
						children: active.caught.map((token) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "rounded-full px-2 py-0.5 font-mono text-2xs text-catch shadow-catch",
							children: token
						}, token))
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: onCopy,
							className: "inline-flex h-11 items-center gap-2 rounded-md px-3 font-mono text-2xs tracking-wide text-paper uppercase shadow-paper transition-colors duration-150 hover:text-wire",
							children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
								className: "size-3.5 text-catch",
								strokeWidth: 2
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, {
								className: "size-3.5",
								strokeWidth: 1.75
							}), copied ? "Copied" : "Copy"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: onDownload,
							className: "inline-flex h-11 items-center gap-2 rounded-md px-3 font-mono text-2xs tracking-wide text-paper uppercase shadow-paper transition-colors duration-150 hover:text-wire",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
								className: "size-3.5",
								strokeWidth: 1.75
							}), "Save"]
						})]
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "pt-1 font-sans text-sm leading-relaxed text-pretty text-dim",
					children: "Nothing caught yet. Open the field and speak — creole, Appalachian, kitchen Italian, anything the default models shave off. Or run a sample catch."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", {
				disabled: settingsDisabled,
				className: "border-t border-hair px-4 py-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
						className: "sr-only",
						children: "Catch settings"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
						label: "Preserve dialect",
						on: settings.dialect,
						onToggle: () => onSettingsChange({
							...settings,
							dialect: !settings.dialect
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
						label: "Keep fillers",
						on: settings.fillers,
						onToggle: () => onSettingsChange({
							...settings,
							fillers: !settings.fillers
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toggle, {
						label: "Mark speakers",
						on: settings.diarize,
						onToggle: () => onSettingsChange({
							...settings,
							diarize: !settings.diarize
						})
					})
				]
			})
		]
	});
}
function HistoryList({ history, onSelect }) {
	if (history.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "font-sans text-sm text-dim",
		children: "No previous catches."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex flex-col gap-1",
		children: history.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => onSelect(item),
			className: "w-full rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-ink",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block font-sans text-sm text-paper line-clamp-2",
				children: item.text
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "mt-1 block font-mono text-2xs text-dim",
				children: [
					new Date(item.at).toLocaleString(),
					" · ",
					formatClock(item.duration)
				]
			})]
		}) }, item.id))
	});
}
function groupBySpeaker(words) {
	if (!words.some((w) => typeof w.speaker === "number")) return [];
	const groups = [];
	for (const w of words) {
		const sp = w.speaker ?? 0;
		const last = groups[groups.length - 1];
		if (!last || last.speaker !== sp) groups.push({
			speaker: sp,
			start: w.start,
			text: w.text
		});
		else last.text += ` ${w.text}`;
	}
	return groups;
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilamentApp, {});
}
//#endregion
export { Home as component };
