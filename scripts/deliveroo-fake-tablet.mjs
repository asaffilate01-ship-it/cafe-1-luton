#!/usr/bin/env node
/**
 * Cafe1 — Deliveroo tablet simulator.
 *
 * Pretends to be the Deliveroo tablet sending a print job, so the whole
 * chain (fake printer -> parser -> KDS) can be proven without any hardware.
 *
 *   node scripts/deliveroo-fake-tablet.mjs                 # -> local bridge on :9100
 *   BRIDGE_HOST=192.168.1.50 node scripts/deliveroo-fake-tablet.mjs
 *
 * Or skip the bridge entirely and post straight to the site:
 *   DELIVEROO_BRIDGE_SECRET=xxx CAFE1_URL=https://cafe1stalbans.co.uk \
 *     node scripts/deliveroo-fake-tablet.mjs --direct
 */
import net from "node:net";

const HOST = process.env.BRIDGE_HOST || "127.0.0.1";
const PORT = Number(process.env.BRIDGE_PORT || 9100);
const DIRECT = process.argv.includes("--direct");

/** A four-character reference, same shape the tablet prints. */
const ref = Array.from({ length: 4 }, () =>
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)],
).join("");

// Byte-for-byte the sort of job a Deliveroo tablet emits: ESC/POS init,
// double-height title, the order body, then a paper cut.
const receipt =
  "\x1b@" +
  "\x1b!\x38DELIVEROO\n" +
  "\x1b!\x00" +
  `Order #${ref}\n` +
  "Customer: Test T\n" +
  "DELIVERY\n" +
  "--------------------------------\n" +
  "2x Bacon Roll             7.00\n" +
  "  - Brown sauce\n" +
  "1x Cappuccino             3.20\n" +
  "  - Oat milk\n" +
  "1 Chocolate Bar           1.20\n" +
  "--------------------------------\n" +
  "Subtotal                 11.40\n" +
  "Total                   £11.40\n" +
  "Notes: Simulated test order\n" +
  "\n\n\n\x1dV\x00";

if (DIRECT) {
  const base = (process.env.CAFE1_URL || "https://cafe1stalbans.co.uk").replace(/\/$/, "");
  const secret = process.env.DELIVEROO_BRIDGE_SECRET;
  if (!secret) {
    console.error("DELIVEROO_BRIDGE_SECRET is required for --direct.");
    process.exit(1);
  }
  const res = await fetch(`${base}/api/public/deliveroo/print-bridge`, {
    method: "POST",
    headers: { "content-type": "text/plain", "x-bridge-secret": secret },
    body: receipt,
  });
  console.log(res.status, await res.text());
  process.exit(res.ok ? 0 : 1);
}

const socket = net.createConnection({ host: HOST, port: PORT }, () => {
  console.log(`[tablet] printing order #${ref} to ${HOST}:${PORT}`);
  socket.end(Buffer.from(receipt, "latin1"));
});
socket.on("close", () => console.log("[tablet] job sent — check the KDS"));
socket.on("error", (err) => {
  console.error("[tablet] could not reach the bridge:", err.message);
  console.error("        Is scripts/deliveroo-print-bridge.mjs running?");
  process.exit(1);
});
