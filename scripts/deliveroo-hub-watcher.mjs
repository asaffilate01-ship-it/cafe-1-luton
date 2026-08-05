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
 *
 * Preferred — give it the device/tablet Hub account so it signs itself in and
 * recovers on its own if Hub ever logs it out. Use an account that is NOT the
 * one staff use day to day: Hub ends the older session when the same account
 * signs in somewhere else, so a shared account would keep kicking people out.
 *   HUB_EMAIL=... HUB_PASSWORD=... DELIVEROO_BRIDGE_SECRET=xxx \
 *     node scripts/deliveroo-hub-watcher.mjs
 *
 * Fallback — sign in by hand once, if the account uses 2FA or an email link:
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
 *   HUB_EMAIL      device account username/email for unattended sign-in
 *   HUB_PASSWORD   device account password (keep it in the machine's env, not here)
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
const HUB_EMAIL = process.env.HUB_EMAIL;
const HUB_PASSWORD = process.env.HUB_PASSWORD;
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

/** Hub bounces signed-out visitors to a login screen; detect that either way. */
async function isSignedOut() {
  if (/login|sign[-_]?in|auth/i.test(page.url())) return true;
  return await page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);
}

/** Sign in with the device account. Returns false if it did not take. */
async function signIn() {
  if (!HUB_EMAIL || !HUB_PASSWORD) return false;
  console.log("\n[hub] signing in with the device account…");
  try {
    const email = page.locator('input[type="email"], input[name*="email" i], input[name*="user" i]').first();
    await email.waitFor({ state: "visible", timeout: 20000 });
    await email.fill(HUB_EMAIL);
    const pw = page.locator('input[type="password"]').first();
    await pw.fill(HUB_PASSWORD);
    await pw.press("Enter");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    if (await isSignedOut()) {
      console.error("[hub] sign-in did not complete — the account may need 2FA. Use --login once instead.");
      return false;
    }
    await page.goto(HUB_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
    await context.storageState({ path: SESSION_FILE }).catch(() => {});
    console.log("[hub] signed in; session saved.");
    return true;
  } catch (err) {
    console.error("[hub] sign-in failed:", err.message);
    return false;
  }
}

if (await isSignedOut()) {
  const ok = await signIn();
  if (!ok) {
    console.error(
      fs.existsSync(SESSION_FILE)
        ? "Saved session has expired. Set HUB_EMAIL/HUB_PASSWORD, or re-run with --login."
        : "No saved session. Set HUB_EMAIL/HUB_PASSWORD, or run once with --login."
    );
    await browser.close();
    process.exit(1);
  }
}

console.log(`[hub] watching ${HUB_URL} -> ${ENDPOINT}`);
console.log("[hub] the tablet keeps working as normal; this only mirrors orders to the KDS.");

// Hub pushes new orders over its own live connection, but reload periodically
// so a dropped connection or an expired session can never silently stall.
let recovering = false;
setInterval(async () => {
  if (recovering) return;
  try {
    await page.reload({ waitUntil: "domcontentloaded" });
    // Hub can end the session at any time; sign straight back in unattended.
    if (await isSignedOut()) {
      recovering = true;
      console.warn("\n[hub] session ended — reconnecting…");
      if (!(await signIn())) console.error("[hub] still signed out; will retry on the next cycle.");
      recovering = false;
    }
  } catch (err) {
    recovering = false;
    console.error("[hub] reload failed:", err.message);
  }
}, REFRESH_MS);

const shutdown = async () => {
  await context.storageState({ path: SESSION_FILE }).catch(() => {});
  await browser.close().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
