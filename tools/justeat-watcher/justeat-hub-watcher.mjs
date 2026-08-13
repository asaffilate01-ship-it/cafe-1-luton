#!/usr/bin/env node
/**
 * Cafe 1 Just Eat Partner Centre watcher.
 *
 * Uses a dedicated persistent Edge profile. The operator signs into
 * Partner Centre once in a real browser window; the watcher never reads or
 * stores the Just Eat username or password. Accepted Hub payloads are copied
 * to Cafe 1's authenticated KDS bridge and deduplicated on the server.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(SCRIPT_DIR, "watcher.config.json");
const PROFILE_DIR = path.join(SCRIPT_DIR, ".justeat-edge-profile");
const LOCK_FILE = path.join(SCRIPT_DIR, ".justeat-hub-watcher.lock");
const LOGIN_REQUIRED_FILE = path.join(SCRIPT_DIR, "LOGIN-REQUIRED.txt");
const SETUP = process.argv.includes("--setup");
const CHECK = process.argv.includes("--check");
const SECRET = process.env.JUSTEAT_BRIDGE_SECRET?.trim();

function readConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    return {
      cafe1Url: String(parsed.cafe1Url || "https://cafe1stalbans.co.uk").replace(/\/$/, ""),
      hubUrl: String(
        parsed.hubUrl || "https://restaurant-hub.deliveroo.net/orders",
      ),
      refreshMs: Math.max(30_000, Number(parsed.refreshMs || 45_000)),
    };
  } catch {
    console.error("Watcher setup is incomplete. Run START-CAFE1-DELIVEROO.cmd again.");
    process.exit(2);
  }
}

const CONFIG = readConfig();
const ENDPOINT = `${CONFIG.cafe1Url}/api/public/justeat/hub-ingest`;

if (!SECRET || !/^[a-f0-9]{64}$/i.test(SECRET)) {
  console.error("The protected Cafe 1 bridge key is missing or invalid. Run setup again.");
  process.exit(2);
}

function claimProcessLock() {
  try {
    const handle = fs.openSync(LOCK_FILE, "wx", 0o600);
    fs.writeFileSync(handle, String(process.pid));
    fs.closeSync(handle);
    return true;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existingPid = Number(fs.readFileSync(LOCK_FILE, "utf8").trim());
    try {
      if (Number.isInteger(existingPid) && existingPid > 0) process.kill(existingPid, 0);
      console.error("Cafe 1 Just Eat watcher is already running.");
      return false;
    } catch {
      fs.rmSync(LOCK_FILE, { force: true });
      return claimProcessLock();
    }
  }
}

if (!CHECK && !claimProcessLock()) process.exit(0);
let ownsLock = !CHECK;
function releaseLock() {
  if (!ownsLock) return;
  ownsLock = false;
  fs.rmSync(LOCK_FILE, { force: true });
}
process.on("exit", releaseLock);

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.error("The private watcher runtime is missing. Run START-CAFE1-DELIVEROO.cmd again.");
  process.exit(2);
}

async function launchContext() {
  const options = {
    headless: !SETUP,
    viewport: { width: 1400, height: 960 },
    ignoreHTTPSErrors: false,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  };
  const channels = ["msedge", "chrome"];
  let lastError;
  for (const channel of channels) {
    try {
      return await chromium.launchPersistentContext(PROFILE_DIR, { ...options, channel });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Microsoft Edge or Google Chrome could not be opened. ${lastError?.message || ""}`.trim(),
  );
}

function isJust EatUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "deliveroo.com" ||
      hostname.endsWith(".deliveroo.com") ||
      hostname === "deliveroo.net" ||
      hostname.endsWith(".deliveroo.net") ||
      hostname === "deliveroo.co.uk" ||
      hostname.endsWith(".deliveroo.co.uk")
    );
  } catch {
    return false;
  }
}

async function send(payloadText, source) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bridge-secret": SECRET,
      "user-agent": "Cafe1-JustEat-Watcher/2",
    },
    body: payloadText,
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${body.error || "bridge rejected"}`);
  if (body.created > 0) {
    console.log(
      `[kds] ${body.created} new order(s): ${(body.references || []).join(", ")}`,
    );
  } else if (body.recognised > 0 && source !== "heartbeat") {
    process.stdout.write(".");
  }
  if (body.cancelled > 0) console.log(`[kds] ${body.cancelled} cancelled order(s) removed.`);
  return body;
}

async function sendSafely(payloadText, source) {
  try {
    return await send(payloadText, source);
  } catch (error) {
    console.error(`\n[bridge] ${source} failed: ${error.message}`);
    return null;
  }
}

async function connectionCheck() {
  try {
    await send(
      JSON.stringify({
        heartbeat: true,
        signedOut: null,
        payloadsSeen: 0,
        watcherVersion: 2,
        at: new Date().toISOString(),
      }),
      "connection-check",
    );
    console.log("Cafe 1 KDS bridge connected.");
    return true;
  } catch (error) {
    console.error(`Cafe 1 KDS bridge is not ready: ${error.message}`);
    return false;
  }
}

if (CHECK) {
  const ok = await connectionCheck();
  releaseLock();
  process.exit(ok ? 0 : 3);
}

let context;
try {
  context = await launchContext();
} catch (error) {
  console.error(error.message);
  releaseLock();
  process.exit(2);
}
const pages = context.pages();
const page = pages[0] || (await context.newPage());
let seenPayloads = 0;
let closing = false;

async function signedOut() {
  if (/login|sign[-_]?in|auth/i.test(page.url())) return true;
  return page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);
}

async function heartbeat(isOut = null) {
  return sendSafely(
    JSON.stringify({
      heartbeat: true,
      signedOut: isOut,
      payloadsSeen: seenPayloads,
      watcherVersion: 2,
      at: new Date().toISOString(),
    }),
    "heartbeat",
  );
}

await page.goto(CONFIG.hubUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});

if (SETUP) {
  console.log("");
  console.log("A Just Eat Partner Centre window is open.");
  console.log("Sign in once using the same device account used at the cafe.");
  console.log("The watcher does not see or save the username or password.");
  console.log("");
  const deadline = Date.now() + 15 * 60_000;
  let connected = false;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    if (await signedOut()) continue;
    await page.goto(CONFIG.hubUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    if (!(await signedOut())) {
      connected = true;
      break;
    }
  }
  if (!connected) {
    console.error("Just Eat sign-in was not completed within 15 minutes.");
    await context.close();
    releaseLock();
    process.exit(4);
  }
  fs.rmSync(LOGIN_REQUIRED_FILE, { force: true });
  const bridgeReady = await connectionCheck();
  console.log(
    bridgeReady
      ? "Just Eat login saved and Cafe 1 KDS connected."
      : "Just Eat login saved, but the website bridge key still needs configuring.",
  );
  await context.close();
  releaseLock();
  process.exit(bridgeReady ? 0 : 3);
}

if (await signedOut()) {
  await heartbeat(true);
  fs.writeFileSync(
    LOGIN_REQUIRED_FILE,
    "Just Eat Partner Centre needs signing in again. Double-click REPAIR-DELIVEROO-LOGIN.cmd.\r\n",
    { mode: 0o600 },
  );
  console.error("Just Eat login is required. Run REPAIR-DELIVEROO-LOGIN.cmd.");
  await context.close();
  releaseLock();
  process.exit(20);
}

const ignored = /\.(js|css|png|jpe?g|svg|gif|woff2?|ico|map)(\?|$)|segment|sentry|datadog|analytics|intercom/i;
context.on("response", async (response) => {
  const url = response.url();
  if (!isJust EatUrl(url) || ignored.test(url)) return;
  if (!(response.headers()["content-type"] || "").includes("json")) return;
  const text = await response.text().catch(() => "");
  if (!text || text.length > 400_000) return;
  seenPayloads += 1;
  await sendSafely(text, "Hub response");
});

page.on("websocket", (socket) => {
  if (!isJust EatUrl(socket.url())) return;
  socket.on("framereceived", async (frame) => {
    const text = typeof frame.payload === "string" ? frame.payload : "";
    if (!text || text.length > 400_000) return;
    if (!text.trimStart().startsWith("{") && !text.trimStart().startsWith("[")) return;
    seenPayloads += 1;
    await sendSafely(text, "Hub socket");
  });
});

fs.rmSync(LOGIN_REQUIRED_FILE, { force: true });
console.log(`[hub] watching ${CONFIG.hubUrl}`);
console.log(`[kds] forwarding accepted order data to ${ENDPOINT}`);
await heartbeat(false);
const heartbeatTimer = setInterval(() => void heartbeat(false), 60_000);

let refreshing = false;
const refreshTimer = setInterval(async () => {
  if (refreshing || closing) return;
  refreshing = true;
  try {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    if (await signedOut()) {
      await heartbeat(true);
      fs.writeFileSync(
        LOGIN_REQUIRED_FILE,
        "Just Eat Partner Centre needs signing in again. Double-click REPAIR-DELIVEROO-LOGIN.cmd.\r\n",
        { mode: 0o600 },
      );
      console.error("Just Eat session ended. Login repair is required.");
      clearInterval(refreshTimer);
      clearInterval(heartbeatTimer);
      await context.close();
      releaseLock();
      process.exit(20);
    }
  } catch (error) {
    console.error(`[hub] refresh failed: ${error.message}`);
  } finally {
    refreshing = false;
  }
}, CONFIG.refreshMs);

async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(refreshTimer);
  clearInterval(heartbeatTimer);
  await context.close().catch(() => {});
  releaseLock();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
