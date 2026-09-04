"""Family board and residual board.

Caught fibers → family (Porch keeps).
Slipped / unsure → residual (Carbon looks).
"""

from __future__ import annotations

import json
import time
from pathlib import Path

ROOT = Path.home() / ".filament"
FAMILY_PATH = ROOT / "family.json"
RESIDUAL_PATH = ROOT / "residual.json"
CAP = 200


def _load(path: Path) -> list[dict]:
    try:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
    except (OSError, json.JSONDecodeError):
        pass
    return []


def _save(path: Path, rows: list[dict]) -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows[:CAP], indent=2), encoding="utf-8")


def _add(path: Path, token: str, region: str, why: str) -> dict | None:
    tok = str(token or "").strip()
    if not tok:
        return None
    rows = _load(path)
    key = tok.lower()
    for row in rows:
        if str(row.get("said") or "").lower() == key:
            row["hits"] = int(row.get("hits") or 1) + 1
            row["at"] = time.time()
            row["region"] = region or row.get("region") or ""
            _save(path, rows)
            return row
    row = {
        "said": tok,
        "keep": tok,
        "region": region or "",
        "why": why,
        "hits": 1,
        "at": time.time(),
        "organ": "porch",
    }
    rows.insert(0, row)
    _save(path, rows)
    return row


def add_family(token: str, region: str = "") -> dict | None:
    return _add(FAMILY_PATH, token, region, "caught on the fibers. family board.")


def add_residual(token: str, region: str = "", why: str = "slipped") -> dict | None:
    return _add(RESIDUAL_PATH, token, region, why)


def snapshot() -> dict:
    return {
        "ok": True,
        "organ": "porch",
        "family": _load(FAMILY_PATH),
        "residual": _load(RESIDUAL_PATH),
    }
