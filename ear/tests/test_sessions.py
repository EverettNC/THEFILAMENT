"""/live keeps one stream per caller. Real runs: the real recognizer and model,
on AlphaVox's own verified phrases. The HTTP check uses a spare port on
127.0.0.1, never 4850, and stops what it starts.
"""

from __future__ import annotations

import json
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from test_live import LIVE_CHUNK, MODEL, SILENCE_1S5, pcm, said

SPARE_PORT = 48517


def chunks(tape: bytes) -> list[bytes]:
    return [tape[i : i + LIVE_CHUNK] for i in range(0, len(tape), LIVE_CHUNK)]


@unittest.skipUnless(Path(MODEL).is_dir(), f"model is not seated at {MODEL}; not run")
class OneStreamPerCaller(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        import vosk_ear

        cls.ear = vosk_ear

    def interleave(self, a_tape: bytes, b_tape: bytes, post) -> tuple[str, str]:
        a, b = chunks(a_tape + SILENCE_1S5), chunks(b_tape + SILENCE_1S5)
        got_a = [post(b"", "alpha", reset=True)]
        got_b = [post(b"", "bravo", reset=True)]
        for i in range(max(len(a), len(b))):
            if i < len(a):
                got_a.append(post(a[i], "alpha"))
            if i < len(b):
                got_b.append(post(b[i], "bravo"))
        got_a.append(post(b"", "alpha", end=True))
        got_b.append(post(b"", "bravo", end=True))
        return said(got_a), said(got_b)

    def test_two_callers_interleaved_do_not_mix(self) -> None:
        def post(chunk, sid, **kw):
            return self.ear.live_hear(chunk, session=sid, **kw)

        a, b = self.interleave(pcm("help"), pcm("music"), post)
        self.assertEqual(a, "i need help please")
        self.assertEqual(b, "i want to listen to music")

    def test_caller_with_no_session_keeps_the_shared_stream(self) -> None:
        self.ear.live_hear(b"", reset=True)
        for c in chunks(pcm("home")):
            self.ear.live_hear(c)
        self.assertEqual(said([self.ear.live_hear(b"", end=True)]), "i want to go home")

    def test_session_names_are_checked(self) -> None:
        self.assertEqual(self.ear.session_of("codec-war:tab.1"), "codec-war:tab.1")
        self.assertEqual(self.ear.session_of(""), "")
        self.assertEqual(self.ear.session_of("../etc"), "")
        self.assertEqual(self.ear.session_of("x" * 65), "")

    def test_over_http_query_and_header(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", SPARE_PORT), self.ear.Ear)
        t = threading.Thread(target=server.serve_forever, daemon=True)
        t.start()
        try:
            def post(chunk, sid, reset=False, end=False):
                q = "&".join(x for x in ("reset=1" if reset else "", "end=1" if end else "") if x)
                url = f"http://127.0.0.1:{SPARE_PORT}/live" + (f"?{q}" if q else "")
                headers = {"Content-Type": "application/octet-stream"}
                if sid == "alpha":
                    url += ("&" if q else "?") + "session=alpha"
                else:
                    headers["X-Filament-Session"] = sid
                req = urllib.request.Request(url, data=chunk, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=180) as r:
                    return json.loads(r.read())

            a, b = self.interleave(pcm("drink"), pcm("home"), post)
            self.assertEqual(a, "i am thirsty i need a drink")
            self.assertEqual(b, "i want to go home")
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
