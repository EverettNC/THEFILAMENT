import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FILAMENT_DOOR, FILAMENT_GITHUB, pickText, pickWords, UNSEATED } from "./ear.ts";
import { DIALECT_MAP, dialectTokens, nextDialectStim } from "./syllables.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

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

  it("trains the US dialect map the minute the filament is live", () => {
    assert.ok(DIALECT_MAP.louisiana.tokens.includes("lagniappe"));
    assert.ok(DIALECT_MAP.florida.tokens.includes("palmetto"));
    assert.ok(DIALECT_MAP.brooklyn.tokens.includes("bodega"));
    assert.ok(DIALECT_MAP.bronx.tokens.includes("deadass"));
    assert.ok(DIALECT_MAP.minnesota.tokens.includes("ope"));
    assert.ok(DIALECT_MAP.texas.tokens.includes("howdy"));
    assert.ok(dialectTokens().length >= 80);
    const pack = nextDialectStim();
    assert.ok(pack.tokens.length > 0);
    const housing = readFileSync(join(root, "public/filament-housing.html"), "utf8");
    assert.match(housing, /248,255,42/);
    assert.match(housing, /filamentStats/);
    assert.match(housing, /slipped/);
    assert.match(housing, /id="pct"/);
  });
});
