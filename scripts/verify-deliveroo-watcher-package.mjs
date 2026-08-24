import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(root, "tools/deliveroo-watcher");
const archivePath = resolve(root, "public/downloads/cafe1-deliveroo-watcher-windows.zip");
const required = [
  "START-CAFE1-DELIVEROO.cmd",
  "install-deliveroo-watcher.ps1",
  "deliveroo-hub-watcher.mjs",
  "deliveroo-hub-watcher.cmd",
  "watcher-runtime.cmd",
  "watcher-launcher.vbs",
  "REPAIR-DELIVEROO-LOGIN.cmd",
  "CHECK-DELIVEROO-STATUS.cmd",
  "README-FIRST.txt",
  "package.json",
  "package-lock.json",
];

const failures = [];
const source = new Map();
for (const file of required) {
  try {
    source.set(file, readFileSync(resolve(sourceRoot, file)));
  } catch {
    failures.push(`missing watcher source file: ${file}`);
  }
}

let archive = {};
try {
  archive = unzipSync(new Uint8Array(readFileSync(archivePath)));
} catch (error) {
  failures.push(`watcher ZIP cannot be read: ${error.message}`);
}

for (const file of required) {
  const zipped = archive[file];
  if (!zipped) {
    failures.push(`watcher ZIP is missing: ${file}`);
    continue;
  }
  const expected = source.get(file);
  if (expected && !Buffer.from(zipped).equals(expected)) {
    failures.push(`watcher ZIP is stale: ${file}`);
  }
}

for (const name of Object.keys(archive)) {
  if (/password|\.env$|bridge-secret|watcher\.config|node_modules|\.runtime|\.deliveroo-edge-profile/i.test(name)) {
    failures.push(`watcher ZIP contains forbidden runtime or credential material: ${name}`);
  }
}

const watcher = source.get("deliveroo-hub-watcher.mjs")?.toString("utf8") ?? "";
for (const marker of [
  "launchPersistentContext",
  "isDeliverooUrl",
  "Cafe1-Deliveroo-Watcher/2",
  "LOGIN-REQUIRED.txt",
  "heartbeat: true",
]) {
  if (!watcher.includes(marker)) failures.push(`watcher control marker missing: ${marker}`);
}
for (const forbidden of ["DEVICE_PASSWORD", "HUB_PASSWORD", "input[type=\"password\"].fill"] ) {
  if (watcher.includes(forbidden)) failures.push(`watcher must not store or enter credentials: ${forbidden}`);
}

const installer = source.get("install-deliveroo-watcher.ps1")?.toString("utf8") ?? "";
for (const marker of [
  "ConvertFrom-SecureString",
  "Get-FileHash $archive -Algorithm SHA256",
  "New-ScheduledTaskSettingsSet",
  "RestartCount 999",
  "LOCALAPPDATA",
]) {
  if (!installer.includes(marker)) failures.push(`installer control marker missing: ${marker}`);
}
for (const forbidden of ["Protect-InstallAccess", "/inheritance:r"]) {
  if (installer.includes(forbidden)) failures.push(`installer must not remove inherited user access: ${forbidden}`);
}

try {
  const packageJson = JSON.parse(strFromU8(archive["package.json"]));
  if (packageJson.dependencies?.["playwright-core"] !== "1.62.1") {
    failures.push("playwright-core must remain exactly pinned to 1.62.1");
  }
} catch {
  failures.push("watcher package.json is invalid");
}

if (failures.length) {
  console.error(`Deliveroo watcher package verification failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Deliveroo watcher package verification passed for ${required.length} files.`);
}
