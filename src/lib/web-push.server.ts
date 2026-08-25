/**
 * Minimal Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) built on WebCrypto so
 * it runs inside the edge worker — the Node-only `web-push` package cannot.
 */
const b64urlToBytes = (value: string): Uint8Array => {
  const pad = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

const bytesToB64url = (bytes: Uint8Array): string => {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const utf8 = (value: string) => new TextEncoder().encode(value);

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function vapidHeader(endpoint: string): Promise<string> {
  const publicKey = process.env["VAPID_PUBLIC_KEY"]!;
  const privateKey = process.env["VAPID_PRIVATE_KEY"]!;
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:hello@cafe1luton.co.uk";
  const audience = new URL(endpoint).origin;
  const raw = b64urlToBytes(publicKey);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(raw.slice(1, 33)),
    y: bytesToB64url(raw.slice(33, 65)),
    d: privateKey,
    ext: true,
  };
  const signingKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = bytesToB64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    utf8(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      }),
    ),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      signingKey,
      utf8(`${header}.${payload}`) as BufferSource,
    ),
  );
  return `vapid t=${header}.${payload}.${bytesToB64url(signature)}, k=${publicKey}`;
}

async function encryptPayload(payload: string, p256dh: string, auth: string) {
  const clientPublic = b64urlToBytes(p256dh);
  const authSecret = b64urlToBytes(auth);
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublic as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeys.privateKey, 256),
  );

  const ikm = await hkdf(
    authSecret,
    shared,
    concat(utf8("WebPush: info\0"), clientPublic, serverPublic),
    32,
  );
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const record = concat(utf8(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      aesKey,
      record as BufferSource,
    ),
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096);
  return concat(salt, recordSize, new Uint8Array([serverPublic.length]), serverPublic, ciphertext);
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Returns true when delivered, false when the subscription should be dropped. */
export async function sendWebPush(
  target: PushTarget,
  message: { title: string; body: string; url?: string; tag?: string },
): Promise<{ ok: boolean; gone: boolean }> {
  if (!process.env["VAPID_PUBLIC_KEY"] || !process.env["VAPID_PRIVATE_KEY"]) {
    return { ok: false, gone: false };
  }
  try {
    const body = await encryptPayload(JSON.stringify(message), target.p256dh, target.auth);
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: {
        Authorization: await vapidHeader(target.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "900",
        Urgency: "high",
      },
      body: body as BodyInit,
    });
    return { ok: res.ok, gone: res.status === 404 || res.status === 410 };
  } catch (err) {
    console.error("[push] send failed", err);
    return { ok: false, gone: false };
  }
}
