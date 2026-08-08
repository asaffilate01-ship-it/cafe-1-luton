import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function validateCapabilityManifest(manifest, readEvidence) {
  const failures = [];
  const results = [];
  const capabilities = Array.isArray(manifest?.capabilities) ? manifest.capabilities : [];
  if (manifest?.schema_version !== 1) failures.push("software capability schema_version must be 1");
  if (!capabilities.length) failures.push("software capability manifest contains no capabilities");

  const ids = new Set();
  for (const capability of capabilities) {
    const capabilityFailures = [];
    if (!capability?.id || !capability?.name) {
      capabilityFailures.push("capability must have an id and name");
    } else if (ids.has(capability.id)) {
      capabilityFailures.push(`duplicate capability id: ${capability.id}`);
    } else {
      ids.add(capability.id);
    }
    if (!Array.isArray(capability?.evidence) || !capability.evidence.length) {
      capabilityFailures.push("capability must declare evidence");
    } else {
      for (const evidence of capability.evidence) {
        let content;
        try {
          content = readEvidence(evidence.path);
        } catch {
          capabilityFailures.push(`${evidence.path}: file is missing`);
          continue;
        }
        for (const marker of evidence.includes ?? []) {
          if (!content.includes(marker)) {
            capabilityFailures.push(`${evidence.path}: required control marker is missing: ${marker}`);
          }
        }
      }
    }
    results.push({
      id: capability?.id ?? null,
      name: capability?.name ?? null,
      passed: capabilityFailures.length === 0,
      failures: capabilityFailures,
    });
    failures.push(...capabilityFailures.map((failure) => `${capability?.id ?? "unknown"}: ${failure}`));
  }

  return {
    schema_version: 1,
    valid: failures.length === 0,
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    capabilities: results,
    failures,
  };
}

export function verifyReleaseCapabilities(repositoryRoot = root) {
  const manifest = JSON.parse(
    readFileSync(resolve(repositoryRoot, "release/software-capabilities.json"), "utf8"),
  );
  return validateCapabilityManifest(manifest, (path) => {
    const absolute = resolve(repositoryRoot, path);
    if (!existsSync(absolute)) throw new Error(`missing ${path}`);
    return readFileSync(absolute, "utf8");
  });
}

function runCli() {
  const report = verifyReleaseCapabilities(root);
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const output = process.argv[outputIndex + 1];
    if (!output) throw new Error("--output requires a file path");
    const target = resolve(root, output);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (!report.valid) {
    console.error(`Release capability verification failed:\n${report.failures.map((item) => `- ${item}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Release capability verification passed for ${report.passed}/${report.total} controls.`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) runCli();
