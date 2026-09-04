import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { feedFilamentCatch, nextCatchTokens, tokenizeCatch } from "./catch.ts";

describe("filament catch feed", () => {
  it("splits speech without inventing tokens", () => {
    assert.deepEqual(tokenizeCatch("  y'all  ain't  "), ["y'all", "ain't"]);
    assert.deepEqual(tokenizeCatch(""), []);
    assert.deepEqual(tokenizeCatch("   "), []);
  });

  it("only emits new tokens from a growing partial", () => {
    const first = nextCatchTokens("y'all ain't", 0);
    assert.deepEqual(first.tokens, ["y'all", "ain't"]);
    assert.equal(first.seen, 2);

    const same = nextCatchTokens("y'all ain't", 2);
    assert.deepEqual(same.tokens, []);
    assert.equal(same.seen, 2);

    const more = nextCatchTokens("y'all ain't reckon", 2);
    assert.deepEqual(more.tokens, ["reckon"]);
    assert.equal(more.seen, 3);
  });

  it("does not rewind when a partial shrinks", () => {
    const shrink = nextCatchTokens("y'all", 2);
    assert.deepEqual(shrink.tokens, []);
    assert.equal(shrink.seen, 2);
  });

  it("pushes tokens through window.filamentCatch", () => {
    const caught: string[] = [];
    const fake = {
      filamentCatch: (text: string) => {
        caught.push(text);
      },
      setTimeout: (fn: () => void) => {
        fn();
        return 0;
      },
    };
    (globalThis as { window: typeof fake }).window = fake;
    assert.equal(feedFilamentCatch("gabagool irie"), 2);
    assert.deepEqual(caught, ["gabagool", "irie"]);
  });
});
