import { readFileSync, writeFileSync } from "node:fs";
import { zipSync } from "fflate";
const sets = [
  ["tools/deliveroo-watcher", "public/downloads/cafe1-deliveroo-watcher-windows.zip", ["START-CAFE1-DELIVEROO.cmd","install-deliveroo-watcher.ps1","deliveroo-hub-watcher.mjs","deliveroo-hub-watcher.cmd","watcher-runtime.cmd","watcher-launcher.vbs","REPAIR-DELIVEROO-LOGIN.cmd","CHECK-DELIVEROO-STATUS.cmd","README-FIRST.txt","package.json","package-lock.json"]],
  ["tools/justeat-watcher", "public/downloads/cafe1-justeat-watcher-windows.zip", ["START-CAFE1-JUSTEAT.cmd","install-justeat-watcher.ps1","justeat-hub-watcher.mjs","justeat-hub-watcher.cmd","watcher-runtime.cmd","watcher-launcher.vbs","REPAIR-JUSTEAT-LOGIN.cmd","CHECK-JUSTEAT-STATUS.cmd","README-FIRST.txt","package.json","package-lock.json"]],
];
for (const [src, out, files] of sets) {
  const entries = {};
  for (const f of files) entries[f] = new Uint8Array(readFileSync(`${src}/${f}`));
  writeFileSync(out, zipSync(entries, { level: 9, mtime: new Date("2026-01-01T00:00:00Z") }));
  console.log("wrote", out);
}
