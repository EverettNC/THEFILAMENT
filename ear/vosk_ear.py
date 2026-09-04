#!/usr/bin/env python3
"""Filament ear — offline Vosk.

Door: 4850. Not Whole House. Not the Bench. Whisper is not in this body.
Empty ear stays empty. No invented speech.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

DOOR = int(os.environ.get("FILAMENT_EAR_PORT", "4850"))
HOME_MODEL = "/Users/EverettN/Downloads/vosk-model-en-us-0.22-lgraph"
HOME_UNZIP = "/Users/EverettN/models/vosk-model-en-us-0.22-lgraph"
REPO_MODEL = str(Path(__file__).resolve().parent.parent / "models" / "vosk-model-en-us-0.22-lgraph")


def resolve_model_path() -> str:
    env = (os.environ.get("VOSK_MODEL_PATH") or "").strip()
    for candidate in (env, HOME_MODEL, HOME_UNZIP, REPO_MODEL):
        if candidate and Path(candidate).is_dir():
            return candidate
    return env or HOME_MODEL


MODEL_PATH = resolve_model_path()

_model = None
_model_error = None
_live_rec = None


UI_PATH = Path(__file__).resolve().parent / "ui.html"
HOUSING_PATH = Path(__file__).resolve().parent / "filament-housing.html"
BARE_PATH = Path(__file__).resolve().parent / "filament.html"
LIVE_PATH = Path(__file__).resolve().parent / "filament-live.html"
DOOR_PATH = Path(__file__).resolve().parent / "filament-door.html"


def seat_model():
    global _model, _model_error
    if _model is not None:
        return _model
    try:
        from vosk import Model  # type: ignore
    except ImportError:
        _model_error = "Vosk is not installed. pip install vosk. Empty ear stays empty."
        return None
    if not Path(MODEL_PATH).is_dir():
        _model_error = f"Vosk model is not seated at {MODEL_PATH}. Empty ear stays empty."
        return None
    try:
        _model = Model(MODEL_PATH)
        _model_error = None
        return _model
    except Exception as exc:  # noqa: BLE001
        _model_error = f"Vosk would not sit: {exc}. Empty ear stays empty."
        return None


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
                "ffmpeg",
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


def hear(pcm: bytes) -> dict:
    from vosk import KaldiRecognizer, SetLogLevel  # type: ignore

    SetLogLevel(-1)
    model = seat_model()
    if model is None:
        return {"ok": False, "error": _model_error, "seated": False}
    rec = KaldiRecognizer(model, 16000)
    rec.SetWords(True)
    chunk = 4000
    for i in range(0, len(pcm), chunk):
        rec.AcceptWaveform(pcm[i : i + chunk])
    final = json.loads(rec.FinalResult() or "{}")
    text = (final.get("text") or "").strip()
    words = []
    for w in final.get("result") or []:
        if not isinstance(w, dict):
            continue
        tok = str(w.get("word") or "").strip()
        if not tok:
            continue
        words.append(
            {
                "text": tok,
                "start": float(w.get("start") or 0),
                "end": float(w.get("end") or 0),
            }
        )
    return {
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
    }


def words_from(payload: dict) -> list[dict]:
    words = []
    for w in payload.get("result") or payload.get("partial_result") or []:
        if not isinstance(w, dict):
            continue
        tok = str(w.get("word") or "").strip()
        if not tok:
            continue
        words.append(
            {
                "text": tok,
                "start": float(w.get("start") or 0),
                "end": float(w.get("end") or 0),
            }
        )
    return words


def live_hear(pcm: bytes, reset: bool = False, end: bool = False) -> dict:
    global _live_rec
    from vosk import KaldiRecognizer, SetLogLevel  # type: ignore

    SetLogLevel(-1)
    model = seat_model()
    if model is None:
        return {"ok": False, "seated": False, "error": _model_error, "engine": "vosk"}
    if reset or _live_rec is None:
        _live_rec = KaldiRecognizer(model, 16000)
        _live_rec.SetWords(True)
        try:
            _live_rec.SetPartialWords(True)
        except Exception:  # noqa: BLE001
            pass
    if end:
        final = json.loads(_live_rec.FinalResult() or "{}")
        _live_rec = None
        text = (final.get("text") or "").strip()
        return {
            "ok": True,
            "final": True,
            "text": text,
            "partial": "",
            "words": words_from(final),
            "engine": "vosk",
            "organ": "filament",
            "cloud": False,
            "seated": True,
        }
    if not pcm:
        return {"ok": True, "final": False, "text": "", "partial": "", "words": [], "seated": True}
    if _live_rec.AcceptWaveform(pcm):
        result = json.loads(_live_rec.Result() or "{}")
        text = (result.get("text") or "").strip()
        return {
            "ok": True,
            "final": True,
            "text": text,
            "partial": "",
            "words": words_from(result),
            "engine": "vosk",
            "organ": "filament",
            "cloud": False,
            "seated": True,
        }
    partial = json.loads(_live_rec.PartialResult() or "{}")
    return {
        "ok": True,
        "final": False,
        "text": "",
        "partial": (partial.get("partial") or "").strip(),
        "words": words_from(partial),
        "engine": "vosk",
        "organ": "filament",
        "cloud": False,
        "seated": True,
    }


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
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
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
        self.send_header("Access-Control-Allow-Headers", "content-type,authorization")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/ui", "/door"):
            self._html(DOOR_PATH if DOOR_PATH.is_file() else HOUSING_PATH)
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
                },
            )
            return
        self._json(404, {"ok": False, "error": "Not this nerve."})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        query = urlparse(self.path).query
        params = dict(part.split("=", 1) if "=" in part else (part, "1") for part in query.split("&") if part)
        if path not in ("/", "/stt", "/transcribe", "/live"):
            self._json(404, {"ok": False, "error": "Not this nerve."})
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
            result = live_hear(pcm, reset=reset, end=end)
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
    print(f"Filament ear on 0.0.0.0:{DOOR}  vosk={'seated' if seated else 'UNSEATED'}")
    if not seated:
        print(_model_error)
    ThreadingHTTPServer(("0.0.0.0", DOOR), Ear).serve_forever()


if __name__ == "__main__":
    main()
