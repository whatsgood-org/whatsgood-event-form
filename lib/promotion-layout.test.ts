import { test } from "node:test";
import assert from "node:assert/strict";
import { PROMOTION_GRID_CLASSES, promotionColumns, promotionModalMaxWidth } from "./promotion-layout.ts";

test("ENG-764: up to four tiers sit on one row", () => {
  assert.equal(promotionColumns(0), 1);
  assert.equal(promotionColumns(1), 1);
  assert.equal(promotionColumns(2), 2);
  assert.equal(promotionColumns(3), 3);
  assert.equal(promotionColumns(4), 4);
});

test("ENG-764: five or more tiers wrap, never more than four per row", () => {
  // FXBG's five tiers: 3+2, not a lone card under a row of four.
  assert.equal(promotionColumns(5), 3);
  assert.equal(promotionColumns(6), 3);
  assert.equal(promotionColumns(7), 4);
  assert.equal(promotionColumns(8), 4);
  assert.equal(promotionColumns(9), 3);
  for (let n = 1; n <= 20; n++) assert.ok(promotionColumns(n) <= 4);
});

test("ENG-764: the modal widens with the column count", () => {
  const widths = [1, 2, 3, 4].map(c => parseFloat(promotionModalMaxWidth(c)));
  assert.deepEqual(widths, [...widths].sort((a, b) => a - b));
});

test("ENG-764: every column count stacks to one card on mobile", () => {
  for (const cls of Object.values(PROMOTION_GRID_CLASSES)) {
    assert.ok(cls.split(" ").includes("grid-cols-1"));
  }
});
