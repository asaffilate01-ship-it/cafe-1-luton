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
 * Setup (once, on any always-on shop PC): run install-deliveroo-watcher.ps1.
 * The installer adds Playwright and its private Chromium automatically.
 *
 * Give it the device Hub account so it signs itself in and recovers on its own
 * if Hub ever logs it out — a browser session expires, the device account does
 * not, so this is the reliable choice when there is only one login.
 *   HUB_USERNAME=... HUB_PASSWORD=... DELIVEROO_BRIDGE_SECRET=xxx \
 *     node scripts/deliveroo-hub-watcher.mjs
 *
 * Because the tablet uses that same account, this deliberately re-uses its
 * saved session and only signs in again when it really has to, with a growing
 * pause between attempts. That stops the PC and the tablet from repeatedly
 * signing each other out. It never touches orders in Hub — it only reads.
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
 *   DEVICE_USERNAME/DEVICE_PASSWORD  device account — tried first
 *   HUB_USERNAME/HUB_PASSWORD        ordinary Hub login — used as backup
 *   SESSION_FILE   where the signed-in session is stored
 *   REFRESH_MS     how often to re-check when Hub is quiet (default 45000)
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

/**
 * Read settings from deliveroo-hub-watcher.env sitting next to this file, so
 * running the watcher by hand (for example with --login) behaves the same as
 * the scheduled task. Anything already in the environment wins.
 */
function loadEnvFile() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(here, "deliveroo-hub-watcher.env");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile();

const LOGIN = process.argv.includes("--login");
const BASE = (process.env.CAFE1_URL || "https://cafe1stalbans.co.uk").replace(/\/$/, "");
const HUB_URL = process.env.HUB_URL || "https://restaurant-hub.deliveroo.net/orders";
const SECRET = process.env.DELIVEROO_BRIDGE_SECRET;
const SESSION_FILE = path.resolve(process.env.SESSION_FILE || "./.deliveroo-hub-session.json");
const REFRESH_MS = Number(process.env.REFRESH_MS || 45000);
/**
 * Two logins can be supplied. The device account is tried first because it
 * never expires, and the ordinary Hub login is kept as a backup for when the
 * device account is busy, rate-limited or asking for 2FA. Either can be left
 * blank; whatever is filled in gets used, in this order.
 */
const CREDENTIALS = [
  {
    label: "device account",
    username: process.env.DEVICE_USERNAME || process.env.HUB_DEVICE_USERNAME,
    password: process.env.DEVICE_PASSWORD || process.env.HUB_DEVICE_PASSWORD,
  },
  {
    label: "Hub login",
    username: process.env.HUB_USERNAME || process.env.HUB_EMAIL,
    password: process.env.HUB_PASSWORD,
  },
].filter((c) => c.username && c.password);
const ENDPOINT = `${BASE}/api/public/deliveroo/hub-ingest`;

/**
 * The tablet shares this account, so signing in is not free: each sign-in can
 * end the tablet's session. Wait longer after each attempt rather than
 * hammering it, and never sign in more than once a minute.
 */
const SIGN_IN_MIN_GAP_MS = 60_000;
let lastSignInAt = 0;
let signInFailures = 0;

if (!SECRET) {
  console.error("DELIVEROO_BRIDGE_SECRET is not set — refusing to start.");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("The private browser is missing. Run install-deliveroo-watcher.ps1 again.");
  process.exit(1);
}

/**
 * Skip only things that plainly cannot carry an order (assets, analytics).
 * Everything else is forwarded and filtered server-side, because Hub renames
 * its endpoints and an order missed here never reaches the kitchen.
 */
const IGNORED = /\.(js|css|png|jpe?g|svg|gif|woff2?|ico|map)(\?|$)|segment|sentry|datadog|google|analytics|intercom/i;
let seenPayloads = 0;

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
  if (IGNORED.test(url)) return;
  if (!(response.headers()["content-type"] || "").includes("json")) return;
  const text = await response.text().catch(() => "");
  if (!text || text.length > 400_000) return;
  seenPayloads += 1;
  await forward(text, url);
});

/**
 * Hub pushes new orders over a live socket rather than a fresh request, so
 * watching HTTP alone can miss an order until the next reload — mirror the
 * socket frames too.
 */
page.on("websocket", (ws) => {
  ws.on("framereceived", async (frame) => {
    const text = typeof frame.payload === "string" ? frame.payload : "";
    if (!text || text.length > 400_000) return;
    if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) return;
    seenPayloads += 1;
    await forward(text, "websocket");
  });
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

/** Try one set of credentials. Returns true when Hub accepted them. */
async function attemptSignIn({ label, username, password }) {
  console.log(`\n[hub] signing in with the ${label}…`);
  try {
    const email = page.locator('input[name*="user" i], input[id*="user" i], input[type="email"], input[name*="email" i], input[type="text"]').first();
    await email.waitFor({ state: "visible", timeout: 20000 });
    await email.fill(username);
    const pw = page.locator('input[type="password"]').first();
    await pw.fill(password);
    await pw.press("Enter");
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    if (await isSignedOut()) {
      console.error(`[hub] the ${label} did not get in (wrong details, or it needs 2FA).`);
      return false;
    }
    await page.goto(HUB_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
    await context.storageState({ path: SESSION_FILE }).catch(() => {});
    console.log(`[hub] signed in with the ${label}; session saved.`);
    return true;
  } catch (err) {
    console.error(`[hub] ${label} sign-in failed:`, err.message);
    return false;
  }
}

/** Sign in, device account first and the Hub login as backup. */
async function signIn() {
  if (CREDENTIALS.length === 0) return false;
  // Back off between attempts: the tablet shares this login, and a sign-in
  // loop here would keep knocking the tablet offline.
  const gap = SIGN_IN_MIN_GAP_MS * Math.min(2 ** signInFailures, 10);
  const wait = lastSignInAt + gap - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastSignInAt = Date.now();
  for (const credential of CREDENTIALS) {
    if (await attemptSignIn(credential)) {
      signInFailures = 0;
      return true;
    }
    // Hub may have left us on a half-filled form; reload before the next try.
    await page.goto(HUB_URL, { waitUntil: "domcontentloaded" }).catch(() => {});
    if (!(await isSignedOut())) {
      signInFailures = 0;
      return true;
    }
  }
  signInFailures += 1;
  console.error("[hub] none of the saved logins worked — run once with --login to sign in by hand.");
  return false;
}

if (await isSignedOut()) {
  const ok = await signIn();
  if (!ok) {
    console.error(
      fs.existsSync(SESSION_FILE)
        ? "Saved session has expired. Set DEVICE_USERNAME/DEVICE_PASSWORD and/or HUB_USERNAME/HUB_PASSWORD, or re-run with --login."
        : "No saved session. Set DEVICE_USERNAME/DEVICE_PASSWORD and/or HUB_USERNAME/HUB_PASSWORD, or run once with --login."
    );
    await browser.close();
    process.exit(1);
  }
}

console.log(`[hub] watching ${HUB_URL} -> ${ENDPOINT}`);
console.log("[hub] the tablet keeps working as normal; this only mirrors orders to the KDS.");

/**
 * Tell Cafe1 the link is alive even when Hub is quiet, so the kitchen display
 * can show "Deliveroo auto-link live" instead of leaving staff guessing.
 */
async function heartbeat() {
  const signedOut = await isSignedOut().catch(() => null);
  await forward(
    JSON.stringify({
      heartbeat: true,
      at: new Date().toISOString(),
      page: page.url(),
      signedOut,
      payloadsSeen: seenPayloads,
    }),
    "heartbeat",
  );
}
await heartbeat();
setInterval(() => void heartbeat(), 60_000);

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
    } else {
      // Keep the saved session fresh so a restart resumes without signing in
      // again — which is what would disturb the tablet.
      await context.storageState({ path: SESSION_FILE }).catch(() => {});
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
