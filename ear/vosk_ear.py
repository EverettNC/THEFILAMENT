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
MODEL_PATH = os.environ.get(
    "VOSK_MODEL_PATH",
    str(Path(__file__).resolve().parent.parent / "models" / "vosk-model-small-en-us-0.15"),
)

_model = None
_model_error = None


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

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type,authorization")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/health", "/stt"):
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
                    "whisper": False,
                    "wholeHouse": False,
                },
            )
            return
        self._json(404, {"ok": False, "error": "Not this nerve."})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path not in ("/", "/stt", "/transcribe"):
            self._json(404, {"ok": False, "error": "Not this nerve."})
            return
        if seat_model() is None:
            self._json(503, {"ok": False, "seated": False, "error": _model_error, "engine": "vosk"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 32 * 1024 * 1024:
            self._json(400, {"ok": False, "error": "No tape reached the ear."})
            return
        body = self.rfile.read(length)
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
