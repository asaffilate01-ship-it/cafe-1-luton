const supplied = process.env.PRODUCTION_BASE_URL ?? process.argv[2];
if (!supplied) {
  console.error("Set PRODUCTION_BASE_URL or pass the production HTTPS origin as an argument.");
  process.exit(1);
}

const base = new URL(supplied);
if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
  console.error("Production smoke checks require a credential-free HTTPS origin.");
  process.exit(1);
}
base.pathname = "/";

const failures = [];
const results = [];

function fail(message) {
  failures.push(message);
}

async function request(path, { protectedRoute = false, inspectPostcode = false } = {}) {
  const url = new URL(path, base);
  let response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "user-agent": "Cafe1-production-smoke/1.0" },
    });
  } catch (error) {
    fail(`${path}: request failed (${error instanceof Error ? error.message : "unknown error"})`);
    return;
  }

  const redirectStatuses = new Set([301, 302, 303, 307, 308]);
  const allowed =
    response.status === 200 || (protectedRoute && redirectStatuses.has(response.status));
  if (!allowed)
    fail(
      `${path}: expected 200${protectedRoute ? " or an authentication redirect" : ""}, received ${response.status}`,
    );

  const headers = response.headers;
  const requiredHeaders = [
    ["strict-transport-security", /max-age=/i],
    ["x-content-type-options", /^nosniff$/i],
    ["referrer-policy", /strict-origin-when-cross-origin/i],
    ["x-frame-options", /^DENY$/i],
    ["permissions-policy", /camera=/i],
    ["content-security-policy", /frame-ancestors\s+'none'/i],
  ];
  for (const [name, expected] of requiredHeaders) {
    const value = headers.get(name) ?? "";
    if (!expected.test(value)) fail(`${path}: missing or invalid ${name}`);
  }

  if (protectedRoute) {
    const cache = headers.get("cache-control") ?? "";
    if (!/private/i.test(cache) || !/no-store/i.test(cache)) {
      fail(`${path}: protected response must use private, no-store caching`);
    }
  }

  if (inspectPostcode && response.status === 200) {
    const html = await response.text();
    if (!html.includes("AL1 3JU")) fail(`${path}: confirmed postcode AL1 3JU is missing`);
    if (html.includes("AL1 3JW")) fail(`${path}: legacy postcode AL1 3JW is still rendered`);
  }

  results.push(`${path} ${response.status}`);
}

await request("/", { inspectPostcode: true });
await request("/menu");
await request("/admin/security", { protectedRoute: true });

if (failures.length) {
  console.error("Production smoke failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Production smoke passed for ${base.origin}: ${results.join(", ")}`);
