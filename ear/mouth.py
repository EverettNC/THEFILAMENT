"""Mouth map + Carbon pile.

Known mangles land as said. Unsure words do not vanish —
they sit aside for Carbon (Everett) to look at.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

CONF_FLOOR = 0.55
CARBON_PATH = Path.home() / ".filament" / "carbon.json"
CARBON_MAX = 80

# What the prissy ear writes → what was said.
MANGLES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bchristmas\b", re.I), "Christman"),
    (re.compile(r"\bchrist\s*man\b", re.I), "Christman"),
    (re.compile(r"\bchris\s*man\b", re.I), "Christman"),
    (re.compile(r"\bchrisman\b", re.I), "Christman"),
    (re.compile(r"\bchristmann\b", re.I), "Christman"),
    (re.compile(r"\bkristman\b", re.I), "Christman"),
    (re.compile(r"\bkristmann\b", re.I), "Christman"),
    (re.compile(r"\bchris\s*men\b", re.I), "Christman"),
    (re.compile(r"\bson\s+of\s+a\s+bitch\b", re.I), "sumbitch"),
    (re.compile(r"\bsonofa\s*bitch\b", re.I), "sumbitch"),
    (re.compile(r"\bsonofabitch\b", re.I), "sumbitch"),
    (re.compile(r"\bsome\s+bitch\b", re.I), "sumbitch"),
    (re.compile(r"\bsum\s+bitch\b", re.I), "sumbitch"),
    (re.compile(r"\bson\s+a\s+bitch\b", re.I), "sumbitch"),
    (re.compile(r"\bson\s+bitch\b", re.I), "sumbitch"),
    (re.compile(r"\bsombitch\b", re.I), "sumbitch"),
    (re.compile(r"\bsumbich\b", re.I), "sumbitch"),
    (re.compile(r"\bsun\s+bitch\b", re.I), "sumbitch"),
    (re.compile(r"\bsomebeach\b", re.I), "sumbitch"),
    (re.compile(r"\baverett\b", re.I), "Everett"),
    (re.compile(r"\beverette\b", re.I), "Everett"),
    (re.compile(r"\beveritt\b", re.I), "Everett"),
)


def recover(text: str) -> tuple[str, list[dict]]:
    next_text = text or ""
    hits: list[dict] = []
    for pat, keep in MANGLES:
        if pat.search(next_text):
            next_text = pat.sub(keep, next_text)
            hits.append({"from": pat.pattern, "to": keep, "why": "mouth map"})
    return next_text, hits


def word_conf(raw: dict) -> float | None:
    for key in ("conf", "confidence"):
        val = raw.get(key)
        if isinstance(val, (int, float)):
            return float(val)
    return None


def shape_words(payload: dict) -> list[dict]:
    out: list[dict] = []
    for w in payload.get("result") or payload.get("partial_result") or []:
        if not isinstance(w, dict):
            continue
        tok = str(w.get("word") or "").strip()
        if not tok:
            continue
        kept, _hits = recover(tok)
        conf = word_conf(w)
        unsure = conf is not None and conf < CONF_FLOOR
        out.append(
            {
                "text": kept,
                "raw": tok,
                "start": float(w.get("start") or 0),
                "end": float(w.get("end") or 0),
                "conf": conf,
                "unsure": unsure,
            }
        )
    return out


def load_carbon() -> list[dict]:
    try:
        if CARBON_PATH.is_file():
            data = json.loads(CARBON_PATH.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
    except (OSError, json.JSONDecodeError):
        pass
    return []


def save_carbon(rows: list[dict]) -> None:
    CARBON_PATH.parent.mkdir(parents=True, exist_ok=True)
    CARBON_PATH.write_text(json.dumps(rows[:CARBON_MAX], indent=2), encoding="utf-8")


def aside_for_carbon(words: list[dict], heard: str) -> list[dict]:
    pile = load_carbon()
    now = time.time()
    added: list[dict] = []
    for w in words:
        if not w.get("unsure"):
            continue
        row = {
            "word": w.get("raw") or w.get("text"),
            "kept": w.get("text"),
            "conf": w.get("conf"),
            "heard": heard,
            "at": now,
            "for": "Carbon",
        }
        pile.insert(0, row)
        added.append(row)
        try:
            from board import add_residual

            add_residual(str(row.get("word") or ""), "", "unsure")
        except Exception:  # noqa: BLE001
            pass
    if added:
        save_carbon(pile)
    return added


def dress(result: dict, payload: dict | None = None) -> dict:
    """Recover mouth map. Flag unsure words for Carbon. Do not invent speech."""
    raw_text = (result.get("text") or result.get("partial") or "").strip()
    words = result.get("words") or shape_words(payload or {})
    if payload is not None:
        words = shape_words(payload)
    kept, hits = recover(raw_text)
    for w in words:
        w_kept, _ = recover(str(w.get("text") or ""))
        w["text"] = w_kept
    result["text"] = kept
    if "transcript" in result:
        result["transcript"] = kept
    if result.get("partial") and not result.get("final"):
        result["partial"] = kept
    result["words"] = words
    result["mouth"] = hits
    unsure = [w for w in words if w.get("unsure")]
    result["unsure"] = unsure
    if result.get("final") is True or (result.get("ok") and result.get("final") is None):
        if unsure:
            aside_for_carbon(unsure, kept)
            result["carbon"] = True
        else:
            result["carbon"] = False
    return result
