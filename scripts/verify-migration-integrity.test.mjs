import assert from "node:assert/strict";
import test from "node:test";

import {
  normaliseMigrationSql,
  validateMigrationEntries,
} from "./verify-migration-integrity.mjs";

test("normalises line endings and harmless trailing whitespace", () => {
  assert.equal(normaliseMigrationSql("SELECT 1;  \r\n"), "SELECT 1;");
});

test("accepts an explicitly acknowledged immutable equivalent pair", () => {
  const known = [["migrations/001.sql", "migrations/002.sql"]];
  const report = validateMigrationEntries(
    [
      { path: "migrations/001.sql", content: "SELECT 1;\n" },
      { path: "migrations/002.sql", content: "SELECT 1;\r\n" },
      { path: "migrations/003.sql", content: "SELECT 2;" },
    ],
    known,
  );
  assert.equal(report.valid, true);
  assert.deepEqual(report.known_equivalent_sets, [known[0]]);
});

test("rejects an unexpected equivalent migration", () => {
  const report = validateMigrationEntries(
    [
      { path: "migrations/001.sql", content: "SELECT 1;" },
      { path: "migrations/002.sql", content: "SELECT 1;" },
    ],
    [],
  );
  assert.equal(report.valid, false);
  assert.match(report.failures[0], /unapproved equivalent migration set/);
});

test("rejects divergence inside the acknowledged pair", () => {
  const report = validateMigrationEntries(
    [
      { path: "migrations/001.sql", content: "SELECT 1;" },
      { path: "migrations/002.sql", content: "SELECT 2;" },
    ],
    [["migrations/001.sql", "migrations/002.sql"]],
  );
  assert.equal(report.valid, false);
  assert.match(report.failures[0], /diverged/);
});
