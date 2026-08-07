import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { connect } from "node:net";
import { spawn } from "node:child_process";

const port = Number(process.env.CAFE1_BRIDGE_PORT ?? 4782);
const host = process.env.CAFE1_BRIDGE_HOST ?? "127.0.0.1";
const token = process.env.CAFE1_BRIDGE_TOKEN ?? "";
const allowedOrigins = new Set(
  (process.env.CAFE1_ALLOWED_ORIGINS ?? "https://cafe1stalbans.co.uk,http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const printerHost = process.env.CAFE1_PRINTER_HOST ?? "";
const printerPort = Number(process.env.CAFE1_PRINTER_PORT ?? 9100);
const printerQueue = process.env.CAFE1_PRINTER_QUEUE ?? "";
const maxBodyBytes = 256 * 1024;

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

function escposText(value) {
  const safe = String(value)
    .replaceAll("£", "GBP ")
    .replaceAll(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
  return Buffer.concat([
    Buffer.from([0x1b, 0x40]),
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
      for (const job of body.jobs) await send(escposText(job?.text ?? ""));
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
