"""Which recognizer sits under the Filament's ear.

Default: ear-core, Everett's own ear (CODECWAR5TH/ear-core). It seats the same
Vosk model folder and answers in the same JSON shapes, with our own MFCC,
i-vectors, network and C graph search. No Kaldi runtime.

FILAMENT_ENGINE=vosk puts the old Vosk/Kaldi recognizer back.
If ear-core cannot be imported, the ear says so and falls back to Vosk,
so the door is never dead.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

EAR_CORE_DIR = os.environ.get(
    "EAR_CORE_DIR", str(Path.home() / "CODECWAR5TH" / "ear-core")
)
WANTED = (os.environ.get("FILAMENT_ENGINE") or "earcore").strip().lower()

ENGINE = "vosk"
ENGINE_NOTE = ""

if WANTED == "earcore":
    try:
        if EAR_CORE_DIR not in sys.path:
            sys.path.insert(0, EAR_CORE_DIR)
        from earcore.recognizer import Model, Recognizer as KaldiRecognizer  # noqa: F401

        def SetLogLevel(_level: int) -> None:  # noqa: N802
            """ear-core has no Kaldi log to quiet."""

        ENGINE = "earcore"
    except Exception as exc:  # noqa: BLE001
        ENGINE_NOTE = f"ear-core would not load ({exc}); Vosk is standing in."
        print(f"[filament] {ENGINE_NOTE}", file=sys.stderr, flush=True)

if ENGINE == "vosk":
    from vosk import KaldiRecognizer, Model, SetLogLevel  # type: ignore  # noqa: F401
