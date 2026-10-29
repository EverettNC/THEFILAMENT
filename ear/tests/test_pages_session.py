"""Every Filament page sends its own stream name on /live.

The pages' own JavaScript lines are run with node, so the check is on the
code the browser runs. The frozen ear/filament.html is not touched and is
checked to be unchanged by this work.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PAGES = [
    "ear/filament-door.html",
    "ear/filament-housing.html",
    "ear/filament-live.html",
    "public/filament-door.html",
    "public/filament-housing.html",
    "public/filament-live.html",
]
NAME = re.compile(r"^[A-Za-z0-9_.:-]{1,64}$")


@unittest.skipUnless(shutil.which("node"), "node is not on this machine; not run")
class PagesSendTheirOwnStream(unittest.TestCase):
    def run_lines(self, lines: list[str], expr: str) -> list:
        js = "\n".join(lines) + f"\nprocess.stdout.write(JSON.stringify({expr}));"
        out = subprocess.run(["node", "-e", js], capture_output=True, text=True, check=True).stdout
        return json.loads(out)

    def test_each_page(self) -> None:
        for page in PAGES:
            text = (REPO / page).read_text(encoding="utf-8")
            posts = re.findall(r"fetch\(EAR\+'/live'\+([^,]+),", text)
            self.assertEqual(posts, ["LQ(q||'')"], page)
            lines = [ln.strip() for ln in text.splitlines() if ln.strip().startswith(("const SESSION", "const LQ"))]
            self.assertEqual(len(lines), 2, page)
            got = self.run_lines(lines, "[SESSION, LQ('?reset=1'), LQ(''), LQ('?end=1')]")
            other = self.run_lines(lines, "SESSION")
            name = got[0]
            self.assertRegex(name, NAME)
            self.assertNotEqual(name, other, f"{page}: two page loads must get two names")
            self.assertEqual(got[1:], [f"?reset=1&session={name}", f"?session={name}", f"?end=1&session={name}"])

    def test_simple_page(self) -> None:
        text = (REPO / "ear/ui.html").read_text(encoding="utf-8")
        self.assertIn('fetch("/live" + (query ? query + "&" : "?") + "session=" + SESSION,', text)
        line = [ln.strip() for ln in text.splitlines() if ln.strip().startswith("const SESSION")]
        self.assertEqual(len(line), 1)
        a, b = self.run_lines(line, "SESSION"), self.run_lines(line, "SESSION")
        self.assertRegex(a, NAME)
        self.assertNotEqual(a, b)

    def test_frozen_page_untouched(self) -> None:
        out = subprocess.run(
            ["git", "-C", str(REPO), "log", "--format=%h", "-1", "--", "ear/filament.html"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        self.assertTrue(out)
        diff = subprocess.run(["git", "-C", str(REPO), "diff", "HEAD", "--", "ear/filament.html"],
                              capture_output=True, text=True, check=True).stdout
        self.assertEqual(diff, "")
        self.assertNotIn("session", (REPO / "ear/filament.html").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
