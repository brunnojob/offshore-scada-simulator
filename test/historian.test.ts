import test from "node:test";
import assert from "node:assert/strict";
import { Historian } from "../src/historian.ts";
test("historian bounds retention and aggregates only good measurements", () => {
  const h = new Historian(3, 10000);
  for (let i = 1; i <= 4; i++)
    h.append(
      { tag: "p", value: i, timestamp: i * 1000, quality: "good" },
      4000,
    );
  h.append({ tag: "p", value: 100, timestamp: 5000, quality: "bad" }, 5000);
  const result = h.query("p", 0, 6000, 6000);
  assert.equal(result[0].count, 2);
  assert.equal(result[0].mean, 3.5);
  assert.throws(() =>
    h.append({ tag: "p", value: 4, timestamp: 4000, quality: "good" }, 5000),
  );
});
