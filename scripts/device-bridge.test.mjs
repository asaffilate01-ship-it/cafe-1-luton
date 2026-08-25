import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import test from "node:test";

async function availablePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function waitForBridge(url, token) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${url}/v1/health`, {
        headers: { Authorization: `Bearer ${token}`, Origin: "https://cafe1luton.co.uk" },
      });
      if (response.ok) return;
    } catch {
      // The child may still be binding its local socket.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error("Device Bridge did not start");
}

test("device bridge enforces origin, bearer token and request validation", async (context) => {
  const port = await availablePort();
  const token = "test-pairing-token-at-least-20-characters";
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [resolve("device-bridge/src/server.mjs")], {
    env: {
      ...process.env,
      CAFE1_BRIDGE_PORT: String(port),
      CAFE1_BRIDGE_TOKEN: token,
      CAFE1_ALLOWED_ORIGINS: "https://cafe1luton.co.uk",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let childError = "";
  child.stderr.on("data", (chunk) => {
    childError += chunk.toString("utf8");
  });
  context.after(() => child.kill("SIGTERM"));

  await waitForBridge(url, token);

  const missingToken = await fetch(`${url}/v1/health`, {
    headers: { Origin: "https://cafe1luton.co.uk" },
  });
  assert.equal(missingToken.status, 401);
  assert.equal(missingToken.headers.get("cache-control"), "no-store");

  const invalidOrigin = await fetch(`${url}/v1/health`, {
    headers: { Authorization: `Bearer ${token}`, Origin: "https://attacker.example" },
  });
  assert.equal(invalidOrigin.status, 403);

  const health = await fetch(`${url}/v1/health`, {
    headers: { Authorization: `Bearer ${token}`, Origin: "https://cafe1luton.co.uk" },
  });
  assert.equal(health.status, 200, childError);
  assert.deepEqual(await health.json(), {
    ok: true,
    service: "cafe1-device-bridge",
    printer: { configured: false, transport: "unconfigured" },
  });
  assert.equal(health.headers.get("access-control-allow-origin"), "https://cafe1luton.co.uk");

  const invalidPrint = await fetch(`${url}/v1/print`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: "https://cafe1luton.co.uk",
    },
    body: JSON.stringify({ jobs: [] }),
  });
  assert.equal(invalidPrint.status, 400);
  assert.match((await invalidPrint.json()).error, /between 1 and 10/);
});
