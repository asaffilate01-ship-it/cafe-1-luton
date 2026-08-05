#!/usr/bin/env node
/**
 * Cafe1 — Deliveroo tablet print bridge.
 *
 * Runs on any always-on device on the cafe's network (the iMin till, a mini PC
 * or a Raspberry Pi). It pretends to be a network receipt printer: the
 * Deliveroo tablet is pointed at this machine's IP on port 9100, and every
 * order it "prints" is forwarded to Cafe1 and lands on the KDS in seconds.
 *
 *   DELIVEROO_BRIDGE_SECRET=xxxx node scripts/deliveroo-print-bridge.mjs
 *
 * Optional env:
 *   BRIDGE_PORT     listen port (default 9100)
 *   CAFE1_URL       target site (default https://cafe1stalbans.co.uk)
 *   PRINTER_HOST    if set, the receipt is also relayed to the real printer
 *   PRINTER_PORT    real printer port (default 9100)
 */
import net from "node:net";

const PORT = Number(process.env.BRIDGE_PORT || 9100);
const BASE = (process.env.CAFE1_URL || "https://cafe1stalbans.co.uk").replace(/\/$/, "");
const SECRET = process.env.DELIVEROO_BRIDGE_SECRET;
const PRINTER_HOST = process.env.PRINTER_HOST || "";
const PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);
const ENDPOINT = `${BASE}/api/public/deliveroo/print-bridge`;

if (!SECRET) {
  console.error("DELIVEROO_BRIDGE_SECRET is not set — refusing to start.");
  process.exit(1);
}

/** Pass the job on to the real printer so paper tickets keep working. */
function relayToPrinter(buffer) {
  if (!PRINTER_HOST) return;
  const out = net.createConnection({ host: PRINTER_HOST, port: PRINTER_PORT }, () => {
    out.end(buffer);
  });
  out.on("error", (err) => console.error("[printer] relay failed:", err.message));
}

async function send(text, attempt = 1) {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "text/plain", "x-bridge-secret": SECRET },
      body: text,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
    console.log(
      `[bridge] sent ${body.reference ?? "?"} -> order ${body.order_id}` +
        (body.duplicate ? " (duplicate, ignored)" : ` (${body.items} items)`) +
        (body.degraded ? " [!] could not read items — check the tablet" : ""),
    );
  } catch (err) {
    console.error(`[bridge] attempt ${attempt} failed:`, err.message);
    // Kitchen tickets matter: keep retrying with backoff rather than dropping.
    if (attempt < 6) setTimeout(() => send(text, attempt + 1), Math.min(30000, 2000 * attempt));
  }
}

const server = net.createServer((socket) => {
  const chunks = [];
  let idle;
  const finish = () => {
    clearTimeout(idle);
    if (!chunks.length) return;
    const buffer = Buffer.concat(chunks.splice(0));
    relayToPrinter(buffer);
    send(buffer.toString("latin1"));
  };
  socket.on("data", (chunk) => {
    chunks.push(chunk);
    // A print job ends when the tablet stops sending; 700ms of silence is it.
    clearTimeout(idle);
    idle = setTimeout(finish, 700);
  });
  socket.on("end", finish);
  socket.on("error", (err) => console.error("[bridge] socket error:", err.message));
});

server.listen(PORT, () => {
  console.log(`[bridge] listening on port ${PORT} -> ${ENDPOINT}`);
  if (PRINTER_HOST) console.log(`[bridge] relaying to real printer ${PRINTER_HOST}:${PRINTER_PORT}`);
});
