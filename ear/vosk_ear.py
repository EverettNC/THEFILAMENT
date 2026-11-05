#!/usr/bin/env python3
"""Filament ear — offline Vosk.

Door: 4850. Not Whole House. Not the Bench. Whisper is not in this body.
Empty ear stays empty. No invented speech.
"""

from __future__ import annotations

import json
import multiprocessing as mp
import os
import queue
import re
import subprocess
import tempfile
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

from mouth import CONF_FLOOR, dress, load_carbon, save_carbon, shape_words
from board import add_family, add_residual, snapshot

DOOR = int(os.environ.get("FILAMENT_EAR_PORT", "4850"))
HOME_MODEL = "/Users/EverettN/Downloads/vosk-model-en-us-0.22"
HOME_UNZIP = "/Users/EverettN/models/vosk-model-en-us-0.22"
REPO_MODEL = str(Path(__file__).resolve().parent.parent / "models" / "vosk-model-en-us-0.22")


def resolve_model_path() -> str:
    env = (os.environ.get("VOSK_MODEL_PATH") or "").strip()
    for candidate in (env, HOME_MODEL, HOME_UNZIP, REPO_MODEL):
        if candidate and Path(candidate).is_dir():
            return candidate
    return env or HOME_MODEL


MODEL_PATH = resolve_model_path()

_model_error = None
#: How long the door waits for the worker to seat the model.
SEAT_WAIT_S = float(os.environ.get("FILAMENT_SEAT_WAIT_S", "120"))
#: How long a whole tape on /stt may take in the worker.
TAPE_WAIT_S = float(os.environ.get("FILAMENT_TAPE_WAIT_S", "600"))


UI_PATH = Path(__file__).resolve().parent / "ui.html"
HOUSING_PATH = Path(__file__).resolve().parent / "filament-housing.html"
BARE_PATH = Path(__file__).resolve().parent / "filament.html"
LIVE_PATH = Path(__file__).resolve().parent / "filament-live.html"
DOOR_PATH = Path(__file__).resolve().parent / "filament-door.html"
MAP_PATH = Path(__file__).resolve().parent / "dialect-map.js"


def seat_model():
    """The model sits once, in the worker. The door only asks whether it sat."""
    global _model_error
    if not Path(MODEL_PATH).is_dir():
        _model_error = f"Vosk model is not seated at {MODEL_PATH}. Empty ear stays empty."
        return None
    hub = _live_hub()
    ok, err = hub.seated(SEAT_WAIT_S)
    _model_error = None if ok else (err or "Vosk did not sit in time. Empty ear stays empty.")
    return hub if ok else None


def ffmpeg_bin() -> str:
    for candidate in ("/usr/local/bin/ffmpeg", "/opt/homebrew/bin/ffmpeg", "ffmpeg"):
        if candidate == "ffmpeg" or Path(candidate).is_file():
            return candidate
    return "ffmpeg"


def to_pcm16_mono_16k(raw: bytes) -> tuple[bytes, float]:
    if raw[:4] == b"RIFF" and raw[8:12] == b"WAVE":
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(raw)
            src = tmp.name
        try:
            with wave.open(src, "rb") as wf:
                ch = wf.getnchannels()
                rate = wf.getframerate()
                width = wf.getsampwidth()
                n = wf.getnframes()
                pcm = wf.readframes(n)
            if ch == 1 and rate == 16000 and width == 2:
                return pcm, n / 16000
        except wave.Error:
            pass
        finally:
            os.unlink(src)

    with tempfile.NamedTemporaryFile(suffix=".bin", delete=False) as src:
        src.write(raw)
        src_path = src.name
    dst = src_path + ".s16"
    try:
        proc = subprocess.run(
            [
                ffmpeg_bin(),
                "-y",
                "-i",
                src_path,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-f",
                "s16le",
                dst,
            ],
            capture_output=True,
            check=False,
        )
        if proc.returncode != 0 or not Path(dst).is_file():
            raise RuntimeError("ffmpeg could not pull PCM from that tape.")
        pcm = Path(dst).read_bytes()
        return pcm, len(pcm) / (16000 * 2)
    finally:
        for p in (src_path, dst):
            try:
                os.unlink(p)
            except OSError:
                pass


SILENCE_TAIL = b"\x00" * (16000 * 2 // 2)  # 0.5s. Last word needs room to align.


def hear(pcm: bytes) -> dict:
    hub = seat_model()
    if hub is None:
        return {"ok": False, "error": _model_error, "seated": False}
    _jid, reply = hub.call("", "tape", pcm, TAPE_WAIT_S)
    if reply is None or reply.get("error"):
        why = (reply or {}).get("error") or "The ear did not finish that tape. Empty ear stays empty."
        return {"ok": False, "error": why, "seated": True}
    final = reply.get("payload") or {}
    text = (final.get("text") or "").strip()
    if not text:
        alts = final.get("alternatives") or []
        if alts and isinstance(alts[0], dict):
            text = str(alts[0].get("text") or "").strip()
    words = shape_words(final)
    return dress(
        {
            "ok": True,
            "text": text,
            "transcript": text,
            "words": words,
            "duration": len(pcm) / (16000 * 2),
            "language": "en",
            "engine": "vosk",
            "organ": "filament",
            "cloud": False,
            "seated": True,
        },
        final,
    )


def words_from(payload: dict) -> list[dict]:
    return shape_words(payload)


def _live_packet(
    final: bool,
    text: str = "",
    partial: str = "",
    payload: dict | None = None,
    job: int = 0,
) -> dict:
    body = {
        "ok": True,
        "final": final,
        "text": text,
        "partial": partial,
        "words": words_from(payload or {}),
        "engine": "vosk",
        "organ": "filament",
        "cloud": False,
        "seated": True,
        "job": job,
    }
    return dress(body, payload or {})


#: How long one /live post waits for the worker before it answers without it.
#: A reply that lands after this is not thrown away: a final is held for the
#: next reply on the same stream, so no final is ever lost.
LIVE_WAIT_S = float(os.environ.get("FILAMENT_LIVE_WAIT_S", "2.5"))
#: An end post waits for its final to land, up to this long, while the worker lives.
END_WAIT_S = float(os.environ.get("FILAMENT_END_WAIT_S", "120"))
#: Fast talk fills one post. Feed the recognizer in 4000-byte bites so it can endpoint.
#: Four seconds without an endpoint balloons the lattice and the ear goes dumb.
HOLD_MAX = 16000 * 2 * 4
CHUNK = 4000


def _join_finals(finals: list[dict]) -> dict:
    texts = [str(p.get("text") or "").strip() for p in finals]
    text = " ".join(t for t in texts if t)
    result: list = []
    for p in finals:
        result.extend(p.get("result") or [])
    payload = {"text": text, "result": result}
    return {"final": True, "text": text, "partial": "", "payload": payload}


def _live_job(model, state: dict, op: str, pcm: bytes) -> dict:
    """One /live post, in the worker. Every bite of audio is heard; no final is dropped."""
    from vosk import KaldiRecognizer  # type: ignore

    def fresh():
        rec = KaldiRecognizer(model, 16000)
        rec.SetWords(True)
        return rec

    if op == "reset" or state.get("rec") is None:
        state["rec"] = fresh()
        state["held"] = 0
        if op == "reset" and not pcm:
            return {"final": False, "text": "", "partial": "", "payload": {}}
    rec = state["rec"]
    finals: list[dict] = []
    for i in range(0, len(pcm), CHUNK):
        piece = pcm[i : i + CHUNK]
        if rec.AcceptWaveform(piece):
            finals.append(json.loads(rec.Result() or "{}"))
            rec = state["rec"] = fresh()
            state["held"] = 0
            continue
        state["held"] += len(piece)
        if state["held"] >= HOLD_MAX:
            try:
                rec.AcceptWaveform(SILENCE_TAIL)
            except Exception:  # noqa: BLE001
                pass
            finals.append(json.loads(rec.FinalResult() or "{}"))
            rec = state["rec"] = fresh()
            state["held"] = 0
    if op == "end":
        try:
            rec.AcceptWaveform(SILENCE_TAIL)
        except Exception:  # noqa: BLE001
            pass
        finals.append(json.loads(rec.FinalResult() or "{}"))
        state["rec"] = None
        state["held"] = 0
    if finals:
        return _join_finals(finals)
    payload = json.loads(rec.PartialResult() or "{}")
    partial = (payload.get("partial") or "").strip()
    return {"final": False, "text": "", "partial": partial, "payload": payload}


#: Streams kept at once. The one idle longest is let go past this many.
MAX_STREAMS = 32
_SESSION_OK = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")


def session_of(value: str | None) -> str:
    """A caller's stream name. Empty means the shared stream old callers use."""
    value = (value or "").strip()
    return value if _SESSION_OK.match(value) else ""


def _tape_job(model, pcm: bytes) -> dict:
    """A whole tape for /stt: its own recognizer, 0.5 s of silence after it."""
    from vosk import KaldiRecognizer  # type: ignore

    rec = KaldiRecognizer(model, 16000)
    rec.SetWords(True)
    padded = pcm + SILENCE_TAIL
    for i in range(0, len(padded), CHUNK):
        rec.AcceptWaveform(padded[i : i + CHUNK])
    return {"final": True, "tape": True, "payload": json.loads(rec.FinalResult() or "{}")}


def _run_tape(model, jid: int, sid: str, pcm: bytes, out_q) -> None:
    try:
        reply = _tape_job(model, pcm)
    except Exception as exc:  # noqa: BLE001
        reply = {"tape": True, "error": f"The ear could not hear that tape: {exc}."}
    out_q.put(("reply", jid, sid, reply))


def _ear_worker(model_path: str, in_q, out_q) -> None:
    """Own process, and the only place the model sits. If the recognizer
    aborts, the HTTP door stays up."""
    try:
        from vosk import Model, SetLogLevel  # type: ignore

        SetLogLevel(-1)
        model = Model(model_path)
    except ImportError:
        why = "Vosk is not installed. pip install vosk. Empty ear stays empty."
        model = None
    except Exception as exc:  # noqa: BLE001
        why = f"Vosk would not sit: {exc}. Empty ear stays empty."
        model = None
    if model is None:
        out_q.put(("seat", False, why))
        while True:
            job = in_q.get()
            if job is None:
                return
            out_q.put(("reply", job[0], job[1], {"error": why}))
    out_q.put(("seat", True, None))
    streams: dict[str, dict] = {}
    while True:
        job = in_q.get()
        if job is None:
            return
        jid, sid, op, pcm = job
        if op == "tape":
            # A tape runs beside the live streams, so a long tape never holds up live words.
            threading.Thread(target=_run_tape, args=(model, jid, sid, pcm or b"", out_q), daemon=True).start()
            continue
        state = streams.pop(sid, None) or {"rec": None, "held": 0}
        streams[sid] = state  # most recently used last
        while len(streams) > MAX_STREAMS:
            streams.pop(next(iter(streams)))
        try:
            reply = _live_job(model, state, op, pcm or b"")
        except Exception:  # noqa: BLE001
            state["rec"] = None
            state["held"] = 0
            reply = {"final": False, "text": "", "partial": "", "payload": {}}
        out_q.put(("reply", jid, sid, reply))


class LiveHub:
    """The parent side of the live worker.

    Each caller has its own stream, named by the session it sends; callers
    that send none share one stream, as before. One reader thread takes every
    reply off the worker's queue and hands it to the post waiting for it. A
    post that gave up waiting leaves its job behind; when that late reply lands
    with words, it is held for that same stream and delivered on its next
    reply. Nothing the worker heard is thrown away.
    """

    def __init__(self, model_path: str) -> None:
        self.model_path = model_path
        self._cv = threading.Condition()
        self._proc = None
        self._in = None
        self._gen = 0
        self._next = 0
        self._waiting: set[int] = set()
        self._replies: dict[int, dict] = {}
        self._late: dict[str, list[dict]] = {}
        self._seat: tuple[bool, str | None] | None = None

    def _ensure(self) -> None:
        with self._cv:
            if self._proc is not None and self._proc.is_alive():
                return
            ctx = mp.get_context("spawn")
            in_q = ctx.Queue()
            out_q = ctx.Queue()
            proc = ctx.Process(target=_ear_worker, args=(self.model_path, in_q, out_q), daemon=True)
            proc.start()
            self._gen += 1
            self._seat = None
            self._proc, self._in = proc, in_q
            threading.Thread(target=self._read, args=(out_q, self._gen), daemon=True).start()

    def _read(self, out_q, gen: int) -> None:
        while True:
            try:
                msg = out_q.get(timeout=1.0)
            except queue.Empty:
                if gen != self._gen:
                    return
                continue
            except (EOFError, OSError):
                return
            if msg[0] == "seat":
                with self._cv:
                    if gen == self._gen:
                        self._seat = (bool(msg[1]), msg[2])
                    self._cv.notify_all()
                continue
            _kind, jid, sid, reply = msg
            with self._cv:
                if jid in self._waiting:
                    self._replies[jid] = reply
                    self._cv.notify_all()
                elif reply.get("tape"):
                    continue
                elif reply.get("final") and str(reply.get("text") or "").strip():
                    self._late.setdefault(sid, []).append(reply)

    def call(self, sid: str, op: str, pcm: bytes, wait_s: float) -> tuple[int, dict | None]:
        self._ensure()
        with self._cv:
            self._next += 1
            jid = self._next
            self._waiting.add(jid)
            proc, in_q = self._proc, self._in
        in_q.put((jid, sid, op, pcm))
        deadline = time.monotonic() + wait_s
        with self._cv:
            while jid not in self._replies:
                left = deadline - time.monotonic()
                if left <= 0 or not proc.is_alive():
                    self._waiting.discard(jid)
                    return jid, None
                self._cv.wait(min(left, 0.5))
            self._waiting.discard(jid)
            return jid, self._replies.pop(jid)

    def seated(self, wait_s: float) -> tuple[bool, str | None]:
        """Start the worker if it is not running, and wait for it to seat the model."""
        self._ensure()
        deadline = time.monotonic() + wait_s
        with self._cv:
            while self._seat is None:
                left = deadline - time.monotonic()
                if left <= 0:
                    return False, "Vosk did not sit in time. Empty ear stays empty."
                if self._proc is None or not self._proc.is_alive():
                    return False, "The ear's worker stopped before the model sat. Empty ear stays empty."
                self._cv.wait(min(left, 0.5))
            return self._seat

    def restart(self) -> None:
        with self._cv:
            proc = self._proc
            self._proc = None
            self._gen += 1
        try:
            if proc is not None:
                proc.kill()
        except Exception:  # noqa: BLE001
            pass

    def take_late(self, sid: str) -> list[dict]:
        with self._cv:
            return self._late.pop(sid, [])


_hub: LiveHub | None = None


def _live_hub() -> LiveHub:
    global _hub
    if _hub is None:
        _hub = LiveHub(MODEL_PATH)
    return _hub


def _quiet_packet() -> dict:
    return {
        "ok": True,
        "final": False,
        "text": "",
        "partial": "",
        "words": [],
        "engine": "vosk",
        "seated": True,
    }


def live_hear(pcm: bytes, reset: bool = False, end: bool = False, session: str = "") -> dict:
    """Live PCM into Vosk. Not a tape. Not a clip. One stream per session."""
    if seat_model() is None:
        return {"ok": False, "seated": False, "error": _model_error, "engine": "vosk"}
    sid = session_of(session)
    op = "reset" if reset else "end" if end else "pcm"
    hub = _live_hub()
    try:
        jid, reply = hub.call(sid, op, pcm or b"", END_WAIT_S if end else LIVE_WAIT_S)
    except Exception:  # noqa: BLE001
        hub.restart()
        return _quiet_packet()
    if reply is not None and reply.get("error"):
        return {"ok": False, "seated": False, "error": reply["error"], "engine": "vosk"}
    finals = hub.take_late(sid)
    if reply is not None and reply.get("final"):
        finals.append(reply)
    if finals:
        joined = _join_finals([f.get("payload") or {"text": f.get("text")} for f in finals])
        return _live_packet(True, text=joined["text"], payload=joined["payload"], job=jid)
    if reply is None:
        return _quiet_packet()
    return _live_packet(False, partial=reply.get("partial") or "", payload=reply.get("payload") or {}, job=jid)


def extract_file(headers: dict[str, str], body: bytes) -> bytes:
    ctype = headers.get("Content-Type", "")
    if "multipart/form-data" not in ctype:
        return body
    bound = ""
    for part in ctype.split(";"):
        part = part.strip()
        if part.lower().startswith("boundary="):
            bound = part.split("=", 1)[1].strip().strip('"')
    if not bound:
        return body
    marker = b"--" + bound.encode()
    chunks = body.split(marker)
    for chunk in chunks:
        if b"filename=" not in chunk and b"name=\"file\"" not in chunk:
            continue
        split = chunk.split(b"\r\n\r\n", 1)
        if len(split) != 2:
            continue
        data = split[1]
        if data.endswith(b"\r\n"):
            data = data[:-2]
        if data.endswith(b"--"):
            data = data[:-2]
        return data
    return body


class Ear(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        return

    def _json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload).encode()
        try:
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError, OSError):
            return

    def _file(self, path: Path, ctype: str) -> None:
        raw = path.read_bytes() if path.is_file() else b""
        self.send_response(200 if raw else 404)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if raw:
            self.wfile.write(raw)

    def _html(self, path: Path) -> None:
        page = path.read_text(encoding="utf-8") if path.is_file() else "<p>UI missing.</p>"
        raw = page.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type,authorization,x-filament-session")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/ui", "/door"):
            self._html(DOOR_PATH if DOOR_PATH.is_file() else HOUSING_PATH)
            return
        if path in ("/dialect-map.js",):
            self._file(MAP_PATH, "application/javascript; charset=utf-8")
            return
        if path in ("/housing",):
            self._html(HOUSING_PATH if HOUSING_PATH.is_file() else LIVE_PATH)
            return
        if path in ("/live.html", "/live-ui"):
            self._html(LIVE_PATH if LIVE_PATH.is_file() else BARE_PATH)
            return
        if path in ("/bare", "/frozen", "/field"):
            self._html(BARE_PATH)
            return
        if path in ("/simple",):
            self._html(UI_PATH)
            return
        if path in ("/health", "/stt", "/live"):
            seated = seat_model() is not None
            self._json(
                200,
                {
                    "ok": seated,
                    "seated": seated,
                    "engine": "vosk",
                    "organ": "filament",
                    "github": "https://github.com/EverettNC/THEFILAMENT",
                    "door": DOOR,
                    "model": MODEL_PATH if seated else None,
                    "error": None if seated else _model_error,
                    "filaments": 7200,
                    "housing": "v2",
                    "wholeHouse": False,
                    "live": True,
                    "carbonFloor": CONF_FLOOR,
                },
            )
            return
        if path in ("/carbon",):
            pile = load_carbon()
            self._json(200, {"ok": True, "for": "Carbon", "count": len(pile), "aside": pile})
            return
        if path in ("/board", "/porch"):
            self._json(200, snapshot())
            return
        self._json(404, {"ok": False, "error": "Not this nerve."})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        query = urlparse(self.path).query
        params = dict(part.split("=", 1) if "=" in part else (part, "1") for part in query.split("&") if part)
        if path not in ("/", "/stt", "/transcribe", "/live", "/carbon", "/board", "/porch"):
            self._json(404, {"ok": False, "error": "Not this nerve."})
            return
        if path == "/carbon":
            save_carbon([])
            self._json(200, {"ok": True, "for": "Carbon", "count": 0, "aside": []})
            return
        if path in ("/board", "/porch"):
            try:
                payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0) or 0) or b"{}")
            except json.JSONDecodeError:
                payload = {}
            if not isinstance(payload, dict):
                payload = {}
            token = str(payload.get("token") or payload.get("said") or "").strip()
            region = str(payload.get("region") or "")
            bin_name = str(payload.get("bin") or payload.get("board") or "family").lower()
            if bin_name == "residual":
                row = add_residual(token, region, str(payload.get("why") or "slipped"))
            else:
                row = add_family(token, region)
            self._json(200, {"ok": True, "row": row, **snapshot()})
            return
        if seat_model() is None:
            self._json(503, {"ok": False, "seated": False, "error": _model_error, "engine": "vosk"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length > 32 * 1024 * 1024:
            self._json(400, {"ok": False, "error": "No tape reached the ear."})
            return
        body = self.rfile.read(length) if length > 0 else b""

        if path == "/live":
            reset = params.get("reset") in ("1", "true")
            end = params.get("end") in ("1", "true")
            ctype = self.headers.get("Content-Type", "")
            pcm = body
            if "multipart/form-data" in ctype or body[:4] == b"RIFF":
                try:
                    audio = extract_file({k: v for k, v in self.headers.items()}, body)
                    pcm, _dur = to_pcm16_mono_16k(audio)
                except Exception as exc:  # noqa: BLE001
                    self._json(400, {"ok": False, "error": str(exc)})
                    return
            session = unquote(params.get("session") or "") or self.headers.get("X-Filament-Session") or ""
            result = live_hear(pcm, reset=reset, end=end, session=session)
            self._json(200 if result.get("ok") else 503, result)
            return

        if length <= 0:
            self._json(400, {"ok": False, "error": "No tape reached the ear."})
            return
        audio = extract_file({k: v for k, v in self.headers.items()}, body)
        if len(audio) < 64:
            self._json(400, {"ok": False, "error": "The fibers did not catch speech."})
            return
        try:
            pcm, _dur = to_pcm16_mono_16k(audio)
        except Exception as exc:  # noqa: BLE001
            self._json(400, {"ok": False, "error": str(exc)})
            return
        result = hear(pcm)
        if not result.get("ok"):
            self._json(503, result)
            return
        if not (result.get("text") or "").strip():
            self._json(
                200,
                {
                    **result,
                    "text": "",
                    "error": None,
                    "note": "Empty ear stays empty. No invented speech.",
                },
            )
            return
        self._json(200, result)


def main() -> None:
    seated = seat_model() is not None
    # Standing rule: the ear listens on this machine only. Never the wildcard.
    host = "127.0.0.1"
    print(f"Filament ear on {host}:{DOOR}  vosk={'seated' if seated else 'UNSEATED'}")
    if not seated:
        print(_model_error)
    ThreadingHTTPServer((host, DOOR), Ear).serve_forever()


if __name__ == "__main__":
    main()
