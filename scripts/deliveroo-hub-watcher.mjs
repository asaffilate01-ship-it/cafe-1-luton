#!/usr/bin/env node
/**
 * Cafe1 — Deliveroo Restaurant Hub watcher.
 *
 * The Deliveroo tablet's built-in printer is sealed, so nothing can be
 * intercepted on the device. This instead keeps a browser signed into
 * Restaurant Hub on a shop machine and mirrors every order it sees onto the
 * Cafe1 KDS. The tablet carries on accepting and printing exactly as now —
 * this changes nothing about how staff work the tablet.
 *
 * It watches Hub's own network traffic rather than reading the screen, so a
 * visual redesign of Hub does not break it. Payloads are forwarded to Cafe1
 * untouched; all interpretation happens server-side, which means this file
 * should never need updating once it is running.
 *
 * Setup (once, on any always-on shop PC):
 *   npm install playwright && npx playwright install chromium
 *   DELIVEROO_BRIDGE_SECRET=xxx node scripts/deliveroo-hub-watcher.mjs --login
 *     ^ opens a window; sign into Hub by hand, then press Enter here.
 *       The session is saved so later runs start signed in.
 *
 * Then run it for real (add to startup):
 *   DELIVEROO_BRIDGE_SECRET=xxx node scripts/deliveroo-hub-watcher.mjs
 *
 * Optional env:
 *   CAFE1_URL      target site (default https://cafe1stalbans.co.uk)
 *   HUB_URL        Hub orders page (default https://restaurant-hub.deliveroo.net/orders)
 *   SESSION_FILE   where the signed-in session is stored
 *   REFRESH_MS     how often to re-check when Hub is quiet (default 45000)
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const LOGIN = process.argv.includes("--login");
const BASE = (process.env.CAFE1_URL || "https://cafe1stalbans.co.uk").replace(/\/$/, "");
const HUB_URL = process.env.HUB_URL || "https://restaurant-hub.deliveroo.net/orders";
const SECRET = process.env.DELIVEROO_BRIDGE_SECRET;
const SESSION_FILE = path.resolve(process.env.SESSION_FILE || "./.deliveroo-hub-session.json");
const REFRESH_MS = Number(process.env.REFRESH_MS || 45000);
const ENDPOINT = `${BASE}/api/public/deliveroo/hub-ingest`;

if (!SECRET) {
  console.error("DELIVEROO_BRIDGE_SECRET is not set — refusing to start.");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright is not installed. Run:  npm install playwright && npx playwright install chromium");
  process.exit(1);
}

/** Hub endpoints worth forwarding. Deliberately broad — the server filters. */
const INTERESTING = /order|ticket|kitchen/i;

async function forward(payloadText, sourceUrl) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-secret": SECRET },
      body: payloadText,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
    if (body.created > 0) {
      console.log(`[hub] ${body.created} new order(s) on the KDS: ${(body.references || []).join(", ")}`);
    } else if (body.recognised > 0) {
      // Hub re-lists the same orders on every poll; silence is correct here.
      process.stdout.write(".");
    }
  } catch (err) {
    console.error(`\n[hub] forward failed (${sourceUrl}):`, err.message);
  }
}

const browser = await chromium.launch({ headless: !LOGIN });
const context = await browser.newContext({
  storageState: fs.existsSync(SESSION_FILE) ? SESSION_FILE : undefined,
  viewport: { width: 1400, height: 1000 },
});
const page = await context.newPage();

context.on("response", async (response) => {
  const url = response.url();
  if (!INTERESTING.test(url)) return;
  if (!(response.headers()["content-type"] || "").includes("json")) return;
  const text = await response.text().catch(() => "");
  if (!text || text.length > 400_000) return;
  await forward(text, url);
});

await page.goto(HUB_URL, { waitUntil: "domcontentloaded" }).catch(() => {});

if (LOGIN) {
  console.log("\nSign into Restaurant Hub in the window that opened, open the Orders page,");
  console.log("then press Enter here to save the session.");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question("", resolve));
  rl.close();
  await context.storageState({ path: SESSION_FILE });
  console.log(`Session saved to ${SESSION_FILE}. Now run without --login.`);
  await browser.close();
  process.exit(0);
}

if (!fs.existsSync(SESSION_FILE)) {
  console.error("No saved session. Run once with --login first.");
  await browser.close();
  process.exit(1);
}

console.log(`[hub] watching ${HUB_URL} -> ${ENDPOINT}`);
console.log("[hub] the tablet keeps working as normal; this only mirrors orders to the KDS.");

// Hub pushes new orders over its own live connection, but reload periodically
// so a dropped connection or an expired session can never silently stall.
setInterval(() => {
  page.reload({ waitUntil: "domcontentloaded" }).catch((err) => console.error("[hub] reload failed:", err.message));
}, REFRESH_MS);

const shutdown = async () => {
  await context.storageState({ path: SESSION_FILE }).catch(() => {});
  await browser.close().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
