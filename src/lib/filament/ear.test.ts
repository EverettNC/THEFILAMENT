import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FILAMENT_DOOR, FILAMENT_GITHUB, pickText, pickWords, UNSEATED } from "./ear.ts";

describe("filament ear", () => {
  it("keeps the cochlea in THEFILAMENT and Vosk on 4850", () => {
    assert.equal(FILAMENT_DOOR, 4850);
    assert.match(FILAMENT_GITHUB, /THEFILAMENT/);
    assert.match(UNSEATED, /Empty ear stays empty/);
    assert.doesNotMatch(UNSEATED, /whisper/i);
  });

  it("reads vosk packets without inventing speech", () => {
    assert.equal(pickText({ text: "y'all ain't" }), "y'all ain't");
    assert.equal(pickText({}), null);
    const words = pickWords({
      words: [{ text: "ain't", start: 0.1, end: 0.4 }, { text: "" }],
    });
    assert.equal(words.length, 1);
    assert.equal(words[0]?.text, "ain't");
  });
});
