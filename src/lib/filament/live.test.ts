import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FILAMENT_DOOR, FILAMENT_LIVE, filamentLiveUrl } from "./ear.ts";
import { getFilamentEngine, liveDoor, LIVE_CHUNK, pcm16Downsample } from "./live.ts";

describe("filament live ear", () => {
  it("sits local Vosk on 4850, not vosk-browser", () => {
    assert.equal(FILAMENT_DOOR, 4850);
    assert.equal(FILAMENT_LIVE, "http://127.0.0.1:4850/live");
    assert.equal(filamentLiveUrl(), "http://127.0.0.1:4850/live");
    assert.deepEqual(liveDoor(), { door: 4850, live: FILAMENT_LIVE });
    assert.equal(typeof getFilamentEngine, "function");
    assert.equal(typeof getFilamentEngine().load, "function");
  });

  it("packs 16k PCM the same way the door does", () => {
    const input = new Float32Array(48000);
    input[0] = 0.5;
    const pcm = pcm16Downsample(input, 48000);
    assert.equal(pcm.length, 16000);
    assert.equal(LIVE_CHUNK, 3200);
    assert.ok(pcm[0] > 0);
  });
});
