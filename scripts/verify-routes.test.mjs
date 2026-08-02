import assert from "node:assert/strict";
import { test } from "node:test";

import { compareRouteIds, extractGeneratedRouteIds } from "./verify-routes.mjs";

test("route coverage ignores harmless generated import ordering", () => {
  const generated = `
    import { Route as Menu } from './routes/menu'
    import { Route as Root } from './routes/__root'
    import { Route as Index } from './routes/index'
    import { Route as Admin } from './routes/admin.security'
  `;

  const report = compareRouteIds(
    ["admin.security", "index", "menu"],
    extractGeneratedRouteIds(generated),
  );
  assert.equal(report.valid, true);
  assert.equal(report.source_count, 3);
});

test("route coverage reports missing, unexpected and duplicated imports", () => {
  const report = compareRouteIds(["index", "menu"], ["index", "legacy", "legacy"]);

  assert.equal(report.valid, false);
  assert.deepEqual(report.missing, ["menu"]);
  assert.deepEqual(report.extra, ["legacy"]);
  assert.deepEqual(report.duplicates, ["legacy"]);
});

test("route coverage preserves nested and escaped route names", () => {
  const generated = `
    import { Route as Sitemap } from './routes/sitemap[.]xml'
    import { Route as Webhook } from './routes/api/public/sumup-webhook'
  `;
  assert.deepEqual(extractGeneratedRouteIds(generated), [
    "api/public/sumup-webhook",
    "sitemap[.]xml",
  ]);
});
