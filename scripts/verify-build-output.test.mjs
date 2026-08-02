import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("build output verifier checks every private route family", async () => {
  const source = await readFile(new URL("./verify-build-output.mjs", import.meta.url), "utf8");

  for (const route of [
    "/api/*",
    "/admin/*",
    "/staff/*",
    "/till/*",
    "/kds/*",
    "/driver/*",
    "/display/*",
    "/pay/*",
    "/order/*",
    "/print/*",
    "/account/*",
    "/tab/*",
    "/checkout/*",
    "/cart/*",
    "/lovable/*",
  ]) {
    assert.match(source, new RegExp(route.replace("*", "\\*")));
  }

  assert.match(source, /private\\b.*no-store/);
  assert.match(source, /pragma:\\s\*no-cache/);
  assert.match(source, /expires:\\s\*0/);
});
