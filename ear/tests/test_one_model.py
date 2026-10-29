"""The model sits once, in the worker. Real runs on AlphaVox's verified phrases."""

from __future__ import annotations

import multiprocessing as mp
import sys
import threading
import unittest
from pathlib import Path

from test_live import LIVE_CHUNK, MODEL, SILENCE_1S5, pcm, said


@unittest.skipUnless(Path(MODEL).is_dir(), f"model is not seated at {MODEL}; not run")
class ModelSitsOnce(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        import vosk_ear

        cls.ear = vosk_ear

    def test_door_process_never_loads_the_model(self) -> None:
        self.assertIsNotNone(self.ear.seat_model())
        out = self.ear.hear(pcm("help"))
        self.assertTrue(out["ok"])
        self.assertEqual(out["text"], "i need help please")
        self.assertEqual([w["raw"] for w in out["words"]], ["i", "need", "help", "please"])
        # The door's own process never imported the recognizer package.
        self.assertNotIn("vosk", sys.modules)
        workers = [p for p in mp.active_children() if p.is_alive()]
        self.assertEqual(len(workers), 1, workers)

    def test_tape_and_live_at_once(self) -> None:
        tape = (pcm("drink") + SILENCE_1S5) * 6
        got: dict = {}
        t = threading.Thread(target=lambda: got.setdefault("tape", self.ear.hear(tape)))
        t.start()
        sid = "beside-a-tape"
        live = [self.ear.live_hear(b"", reset=True, session=sid)]
        music = pcm("music")
        for i in range(0, len(music), LIVE_CHUNK):
            live.append(self.ear.live_hear(music[i : i + LIVE_CHUNK], session=sid))
        live.append(self.ear.live_hear(b"", end=True, session=sid))
        t.join(timeout=300)
        self.assertEqual(said(live), "i want to listen to music")
        self.assertEqual(got["tape"]["text"].count("thirsty"), 6)

    def test_health_says_seated(self) -> None:
        self.assertIsNotNone(self.ear.seat_model())
        self.assertIsNone(self.ear._model_error)


if __name__ == "__main__":
    unittest.main()
