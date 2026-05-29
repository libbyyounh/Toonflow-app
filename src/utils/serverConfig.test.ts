import test from "node:test";
import assert from "node:assert/strict";

import { resolveListenPort } from "./serverConfig";

test("resolveListenPort returns random port sentinel when requested", () => {
  assert.equal(resolveListenPort(true, { PORT: "3000" }), 0);
});

test("resolveListenPort honors a valid PORT environment variable", () => {
  assert.equal(resolveListenPort(false, { PORT: "3000" }), 3000);
});

test("resolveListenPort falls back to 10588 for invalid PORT values", () => {
  assert.equal(resolveListenPort(false, { PORT: "abc" }), 10588);
  assert.equal(resolveListenPort(false, { PORT: "70000" }), 10588);
});
