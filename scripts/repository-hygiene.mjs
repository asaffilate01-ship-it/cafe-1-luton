import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(scriptPath), "..");

export function isForbiddenEnvironmentPath(path) {
  const name = basename(path);
  return (
    name === ".env" ||
    name === "env.example" ||
    name === ".dev.vars" ||
    (name.startsWith(".env.") && name !== ".env.example")
  );
}

export function getTrackedEnvironmentFiles(root = defaultRoot) {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter((path) => path && isForbiddenEnvironmentPath(path));
}

export function removeTrackedEnvironmentFiles(root = defaultRoot) {
  const paths = getTrackedEnvironmentFiles(root);
  if (!paths.length) return [];

  execFileSync("git", ["rm", "--cached", "--", ...paths], {
    cwd: root,
    stdio: "inherit",
  });
  return paths;
}

function main() {
  const apply = process.argv.includes("--apply");
  const paths = getTrackedEnvironmentFiles();

  if (!paths.length) {
    console.log("Repository hygiene passed: no forbidden environment files are tracked.");
    return;
  }

  if (!apply) {
    console.log(
      `Repository hygiene found ${paths.length} tracked environment file(s):\n${paths.map((path) => `- ${path}`).join("\n")}`,
    );
    console.log("Run with --apply to remove them from Git tracking without rewriting history.");
    return;
  }

  const removed = removeTrackedEnvironmentFiles();
  console.log(
    `Removed ${removed.length} environment file(s) from Git tracking. Runtime values were not printed.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) main();
