import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { connect } from "node:net";
import { spawn } from "node:child_process";

const port = Number(process.env.CAFE1_BRIDGE_PORT ?? 4782);
const host = process.env.CAFE1_BRIDGE_HOST ?? "127.0.0.1";
const token = process.env.CAFE1_BRIDGE_TOKEN ?? "";
const allowedOrigins = new Set(
  (process.env.CAFE1_ALLOWED_ORIGINS ?? "https://cafe1luton.co.uk,http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const printerHost = process.env.CAFE1_PRINTER_HOST ?? "";
const printerPort = Number(process.env.CAFE1_PRINTER_PORT ?? 9100);
const printerQueue = process.env.CAFE1_PRINTER_QUEUE ?? "";
const maxBodyBytes = 256 * 1024;

// Monochrome 120px Café 1 mark encoded as an ESC/POS GS v 0 raster command.
// Keeping it local makes receipt printing reliable even when the till is offline.
const cafe1LogoRaster = Buffer.from(
  "HXYwAA8AdQAAAAAAAAf8AAAAAAAAAAAAAAAAAB/+AAAAAAAAAAAAAAAAAH//AAAAAAAAAAAAAAAAAf//gAAAAAAAAAAAAAAAB///wAAAAAAAAAAAAAAAD///wAAAAAAAAAAAAAAAH///4AAAAAAAAAAAAAAAP//P4AAAAAAAAAAAAAAA//4D4AAAAAAcAAAAAAAB//wD4AAAAAA8AAAAAAAB//AD4AAAAAB8AAAAAAAH/+AD4AAAAAH8AAAAAAAH/8AD4AAAAAP4AAAAAAAP/4AP4AAAAAfwAAAAAAAf/wAf4AAAAAfwAAAAAAA//gA/4AAAAA/gAAAAAAB/+AD/4AAAAB/gAAAAAAD/+AP/wAAAAB/AAAAAAAD/8Af/wAAAAB/AAAAAAAH/4B//wAAAAD+AAAAAAAP/wD//gAAAAH+AAAAAAAf/gH//gAAAAH8AAAAAAAf/AP//gAAAAH8AAAAAAA/+AP//AAAAAP4AAAAAAB/+Af/+AAAAAfwAAAAAAD/8Af/+AAAAAfwAAAAAAD/4Af/8AAAAA/wAAAAAAH/4Af/4AAAAA/gAAAAAAP/wAf/wAAAAB/AAAAAAAP/gAf/gAAAAD/AcAAAAAf/AAP/AAAAAD+AcAAAAAf/AAP/AAAAAH+AcAAAAA/+AAD4Af4AAH8A8AAAAB/8AAAAA/8AAP8A8AAAAB/8AAAAB/+AAP4A4AAAAD/4AAAAD+/AAf4HAAAAAD/wAAAAH8fAAfw/gAAAAH/wAAAAPwfAA/h/wAAAAP/gAAAAfgfAB/j/wAAAAP/gAAAA/gfAB/HhwAAAAP/AAAAB+AfAD/PBgAAAAf+AAAAD+A/AH+PPg4AAAf+AAAAH+B/AP+f/h4AAA/8AAAAP8D/Af8f/DwAAA/8AAAAf8H+B/4f+PgAAB/4AAAA+8/+H/4+A+AAAB/4AAAA8/+//vw8B8AAAD/wAAAB4/8//Pw8HwAAAD/wAAADwfwf8fge/AAAAH/gAAAHwfgf4/gf8AAAAH/gAAAPgEAfx/APwAAAAH/AAAAfAAAGB+AAAAAAAH/AAAA+AAAAD///AAAAAP+AAAB8AAD//////wAAAP+AAAB8AAH//////+AAAf+AAAD4AAP///////gAAf8AAAPwAAf///////8AAf8AAAPgAAf////////AAf4AAA/AAAAAfwAH///gA/4AAB+AAAAAfgAAP//wA/wAAB+AAAAA/gAAB//4A/wAAD4AAAAA/AAAAH/+A/wAAHwAAAAB+AAAAD/+B/gAAPwAAAAB+AAAAA//B/gAAfgAAAAD+AAAAAP/h/gAA/AAAAAD+AAAAAH/j/AAB+AAAAAH8AAAAAD/j/AAD8AAAAAH8AAAAAB/z/AAH4AAAAAP4AAAAAA/z/AAPwAAAAAP4AABwAA/7/AAfgAAAAAfwAAD4AAf7+AAfgAAAAAfwAAH4AAf7+AB/AAAAAAfwAAPwAAP/+AD+AAAAAA/wAAPwAAP/+AH4AAAAAA/gAA/wAAP/+AP4AAAAAB/gAB/gAAP/+AfwAAAAAB/gAD/gAAH/+A/gAAAAAD/AAP/gAAH/+B/AAAAAAD/AAPvAAAH9/H+AAAAAAD/AAPPAAAH9//4AAAAAAD/AAAPAAAH8//wAAAAAAD/AAAPAAAH8f/gAAAAAAH/AAAeAAAH8f+AAAAAAAH/AAAeAAAH8H8AAAAAAAH/AAAeAAAH8AAAAAAAAAP/AAA+AAAH8AAAAAAAAAP/AAA+AAAH8AAAAAAAAAP/AAA+AAAP4AAAAAAAAAP/AAA8AAAP4AAAAAAAAAf/AAA8AAAP4AAAAAAAAAf/AAA8AAAPwAAAAAAAAAf/AAB8AAAfwAAAAAAAAAf/AAB8AAAfwAAAAAAAAAf/AAB4AAA/gAAAAAAAAAf/AAD4AAA/gAAAAAAAAAf/AAB4AAA/gAAAAAAAAAf/AAAAAAB/AAAAAAAAAAf/gAAAAAD/AAAAAAAAAAP/gAAAAAH+AAAAAAAAAAP/wAAAAAP+AAAAAAAAAAP/wAAAAAf8AAAAAAAAAAH/4AAAAA/4AAAAAAAAAAH/8AAAAB/wAAAAAAAAAAH/+AAAAD/wAAAAAAAAAAD//AAAAP/gAAAAAAAAAAD//gAAAf/AAAAAAAAAAAB//4AAD/+AAAAAAAAAAAA//8AAP/8AAAAAAAAAAAAf//gB//4AAAAAAAAAAAAP//////gAAAAAAAAAAAAH//////AAAAAAAAAAAAAD/////+AAAAAAAAAAAAAA/////4AAAAAAAAAAAAAAP////gAAAAAAAAAAAAAAD///+AAAAAAAAAAAAAAAAf//wAAAAAAAAAAAAAAAAD/+AAAAA=",
  "base64",
);

if (token.length < 20) {
  throw new Error("CAFE1_BRIDGE_TOKEN must contain at least 20 characters");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid bridge port");
if (!Number.isInteger(printerPort) || printerPort < 1 || printerPort > 65535) {
  throw new Error("Invalid printer port");
}

const transport = printerHost ? "network-escpos" : printerQueue ? "system-queue" : "unconfigured";

function signature(value) {
  return createHmac("sha256", token).update(value).digest();
}

function authorised(req) {
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (!supplied) return false;
  return timingSafeEqual(signature(supplied), signature(token));
}

function originAllowed(req) {
  const origin = req.headers.origin;
  return !origin || allowedOrigins.has(origin);
}

function cors(req) {
  const origin = req.headers.origin;
  return origin && allowedOrigins.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        Vary: "Origin",
      }
    : {};
}

function reply(req, res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...cors(req),
  });
  res.end(JSON.stringify(body));
}

async function jsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("Request is too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function escposTicket(job) {
  const safe = String(job?.text ?? "")
    .replaceAll("£", "GBP ")
    .replaceAll(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
  return Buffer.concat([
    Buffer.from([0x1b, 0x40]),
    ...(job?.logo
      ? [Buffer.from([0x1b, 0x61, 0x01]), cafe1LogoRaster, Buffer.from([0x0a, 0x1b, 0x61, 0x00])]
      : []),
    Buffer.from(safe, "ascii"),
    Buffer.from([0x1d, 0x56, 0x42, 0x00]),
  ]);
}

function sendTcp(payload) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: printerHost, port: printerPort });
    socket.setTimeout(5_000);
    socket.once("connect", () => socket.end(payload));
    socket.once("timeout", () => socket.destroy(new Error("Printer connection timed out")));
    socket.once("error", reject);
    socket.once("close", (hadError) => {
      if (!hadError) resolve();
    });
  });
}

function sendQueue(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn("lp", ["-d", printerQueue, "-o", "raw"], {
      stdio: ["pipe", "ignore", "pipe"],
      shell: false,
    });
    let error = "";
    child.stderr.on("data", (chunk) => {
      error += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(error.trim() || `Print queue exited with ${code}`));
    });
    child.stdin.end(payload);
  });
}

async function send(payload) {
  if (printerHost) return sendTcp(payload);
  if (printerQueue) return sendQueue(payload);
  throw new Error("No printer is configured on this Device Bridge");
}

const server = createServer(async (req, res) => {
  if (!originAllowed(req)) return reply(req, res, 403, { error: "Origin is not allowed" });
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(req));
    return res.end();
  }
  if (!authorised(req)) return reply(req, res, 401, { error: "Bridge pairing token is invalid" });

  try {
    if (req.method === "GET" && req.url === "/v1/health") {
      return reply(req, res, 200, {
        ok: true,
        service: "cafe1-device-bridge",
        printer: { configured: transport !== "unconfigured", transport },
      });
    }
    if (req.method === "POST" && req.url === "/v1/print") {
      const body = await jsonBody(req);
      if (!Array.isArray(body.jobs) || !body.jobs.length || body.jobs.length > 10) {
        return reply(req, res, 400, { error: "Provide between 1 and 10 print jobs" });
      }
      for (const job of body.jobs) await send(escposTicket(job));
      return reply(req, res, 200, { ok: true });
    }
    if (req.method === "POST" && req.url === "/v1/drawer/open") {
      await jsonBody(req);
      await send(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
      return reply(req, res, 200, { ok: true });
    }
    return reply(req, res, 404, { error: "Not found" });
  } catch (error) {
    console.error(new Date().toISOString(), req.method, req.url, error);
    return reply(req, res, 503, {
      error: error instanceof Error ? error.message : "Device operation failed",
    });
  }
});

server.listen(port, host, () => {
  console.log(`Cafe 1 Device Bridge listening on http://${host}:${port}`);
  console.log(`Printer transport: ${transport}`);
});
