import assert from "node:assert/strict";
import test from "node:test";

import { verifySeoRepository } from "./verify-seo.mjs";

test("verifies the complete local-search implementation", () => {
  const report = verifySeoRepository();
  assert.equal(report.valid, true, report.failures.join("\n"));
  assert.equal(report.local_route_count, 3);
  assert.equal(report.blog_article_count, 9);
});
