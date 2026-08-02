import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  isForbiddenEnvironmentPath,
  removeTrackedEnvironmentFiles,
} from "./repository-hygiene.mjs";

test("identifies tracked runtime environment files", () => {
  for (const path of [
    ".env",
    "env.example",
    ".dev.vars",
    ".env.production",
    "apps/till/.env.local",
  ]) {
    assert.equal(isForbiddenEnvironmentPath(path), true, path);
  }
});

test("allows the documented environment contract and ordinary files", () => {
  for (const path of [".env.example", "docs/env.md", "src/environment.ts", "package.json"]) {
    assert.equal(isForbiddenEnvironmentPath(path), false, path);
  }
});

test("removes a runtime environment file from Git tracking without deleting its bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "cafe1-hygiene-test-"));
  const git = (args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });

  try {
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.name", "Hygiene test"]);
    git(["config", "user.email", "hygiene@example.invalid"]);
    writeFileSync(join(root, ".gitignore"), ".env\n");
    writeFileSync(join(root, ".env"), "TEST_ONLY=value\n");
    git(["add", ".gitignore"]);
    git(["add", "-f", ".env"]);
    git(["commit", "-qm", "test fixture"]);

    assert.deepEqual(removeTrackedEnvironmentFiles(root), [".env"]);
    assert.equal(existsSync(join(root, ".env")), true);
    assert.equal(execFileSync("git", ["ls-files", ".env"], { cwd: root, encoding: "utf8" }), "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
