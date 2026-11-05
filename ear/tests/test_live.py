"""/live never loses a final. Real runs: the real recognizer, the real model,
and AlphaVox's own verified phrases (tests/audio, from EverettNC/AlphaVox
data/phrases/alphavox_verified, resampled to 16 kHz mono).

Run from the repo root:
    VOSK_MODEL_PATH=~/models/vosk-model-en-us-0.22 \
    <python with the ear's packages> -m unittest discover -s ear/tests -v

If the model is not seated, these tests say so and are not run.
"""

from __future__ import annotations

import os
import sys
import unittest
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
AUDIO = HERE / "audio"
MODEL = os.environ.get("VOSK_MODEL_PATH") or str(Path.home() / "models" / "vosk-model-en-us-0.22")
os.environ["VOSK_MODEL_PATH"] = MODEL

PHRASES = {
    "help": "alphavox_i_need_help_please.wav",
    "home": "alphavox_i_want_to_go_home.wav",
    "drink": "alphavox_i_am_thirsty_i_need_a_drink.wav",
    "music": "alphavox_i_want_to_listen_to_music.wav",
}
SILENCE_1S5 = b"\x00" * (16000 * 2 * 3 // 2)
LIVE_CHUNK = 3200  # what src/lib/filament/live.ts posts


def pcm(key: str) -> bytes:
    with wave.open(str(AUDIO / PHRASES[key]), "rb") as wf:
        assert wf.getframerate() == 16000 and wf.getnchannels() == 1 and wf.getsampwidth() == 2
        return wf.readframes(wf.getnframes())


def said(packets: list[dict]) -> str:
    return " ".join(p["text"] for p in packets if p.get("final") and p.get("text")).lower().strip()


def three() -> bytes:
    return pcm("help") + SILENCE_1S5 + pcm("home") + SILENCE_1S5 + pcm("drink") + SILENCE_1S5


@unittest.skipUnless(Path(MODEL).is_dir(), f"model is not seated at {MODEL}; not run")
class LiveNeverDropsAFinal(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        import vosk_ear

        cls.ear = vosk_ear
        cls.wait = vosk_ear.LIVE_WAIT_S

    def tearDown(self) -> None:
        self.ear.LIVE_WAIT_S = self.wait

    def stream(self, tape: bytes) -> list[dict]:
        out = [self.ear.live_hear(b"", reset=True)]
        for i in range(0, len(tape), LIVE_CHUNK):
            out.append(self.ear.live_hear(tape[i : i + LIVE_CHUNK]))
        out.append(self.ear.live_hear(b"", end=True))
        return out

    def assert_heard_all_three(self, text: str) -> None:
        for piece in ("help please", "go home", "thirsty", "drink"):
            self.assertIn(piece, text)

    def test_slow_worker_every_final_still_arrives(self) -> None:
        on_time = said(self.stream(three()))
        self.assert_heard_all_three(on_time)
        # Now the post never waits: every reply is late. The old door threw those away.
        self.ear.LIVE_WAIT_S = 0.0
        packets = self.stream(three())
        quiet = [p for p in packets[1:-1] if "job" not in p]
        self.assertGreater(len(quiet), 0, "the worker was never late, so this run proved nothing")
        self.assertEqual(said(packets), on_time)

    def test_audio_on_reset_and_on_end_is_heard(self) -> None:
        # Codec War posts its first chunk with reset, and a caller may post its last with end.
        tape = pcm("music")
        half = (len(tape) // 4) * 2  # on a sample boundary
        first = self.ear.live_hear(tape[:half], reset=True)
        last = self.ear.live_hear(tape[half:], end=True)
        self.assertTrue(last["final"])
        self.assertEqual(said([first, last]), "i want to listen to music")

    def test_one_long_post_keeps_every_phrase(self) -> None:
        # One post holding three phrases: an endpoint inside it must not cut the rest off.
        self.ear.live_hear(b"", reset=True)
        one = self.ear.live_hear(three())
        last = self.ear.live_hear(b"", end=True)
        self.assert_heard_all_three(said([one, last]))


if __name__ == "__main__":
    unittest.main()
