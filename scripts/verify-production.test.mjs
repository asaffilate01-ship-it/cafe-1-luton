import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PRODUCTION_CHECKS,
  parseProductionOrigin,
  verifyProduction,
} from "./verify-production.mjs";

const securityHeaders = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(self), microphone=()",
  "content-security-policy":
    "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
};

function successfulFetch(input) {
  const url = new URL(input);
  const specification = PRODUCTION_CHECKS.find((check) => check.path === url.pathname);
  assert.ok(specification, url.pathname);
  const status = specification.statuses[0];
  let body = "";
  let contentType = "text/html; charset=utf-8";

  if (url.pathname === "/") body = "<html>Cafe 1, St Albans Crown Court, AL1 3JU</html>";
  if (url.pathname === "/robots.txt") {
    body = "User-agent: *\nDisallow: /admin\nSitemap: https://cafe1stalbans.co.uk/sitemap.xml\n";
    contentType = "text/plain; charset=utf-8";
  }
  if (url.pathname === "/sitemap.xml") {
    body = '<?xml version="1.0"?><urlset />';
    contentType = "application/xml";
  }

  const headers = new Headers({ ...securityHeaders, "content-type": contentType });
  if (specification.protectedRoute) {
    headers.set("cache-control", "private, no-store, max-age=0");
  }
  return Promise.resolve(new Response(body, { status, headers }));
}

test("accepts only a credential-free HTTPS production origin", () => {
  assert.equal(
    parseProductionOrigin("https://cafe1stalbans.co.uk/path").href,
    "https://cafe1stalbans.co.uk/",
  );
  assert.throws(() => parseProductionOrigin("http://cafe1stalbans.co.uk"), /credential-free HTTPS/);
  assert.throws(
    () => parseProductionOrigin("https://user:pass@example.com"),
    /credential-free HTTPS/,
  );
});

test("passes the full production contract and records structured checks", async () => {
  const report = await verifyProduction({
    baseUrl: "https://cafe1stalbans.co.uk",
    fetchImpl: successfulFetch,
  });

  assert.equal(report.passed, true);
  assert.equal(report.check_count, PRODUCTION_CHECKS.length);
  assert.equal(
    report.checks.every((check) => check.passed),
    true,
  );
});

test("reports protected caching and postcode regressions", async () => {
  const report = await verifyProduction({
    baseUrl: "https://cafe1stalbans.co.uk",
    fetchImpl: async (input) => {
      const response = await successfulFetch(input);
      const url = new URL(input);
      if (url.pathname === "/admin/security") {
        const headers = new Headers(response.headers);
        headers.set("cache-control", "no-cache");
        return new Response(response.body, { status: response.status, headers });
      }
      if (url.pathname === "/") {
        return new Response("AL1 3JW", { status: 200, headers: response.headers });
      }
      return response;
    },
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.failures.some((failure) => failure.includes("private, no-store")),
    true,
  );
  assert.equal(
    report.failures.some((failure) => failure.includes("AL1 3JW")),
    true,
  );
});

test("rejects protected content served from an intermediary cache", async () => {
  const report = await verifyProduction({
    baseUrl: "https://cafe1stalbans.co.uk",
    fetchImpl: async (input) => {
      const response = await successfulFetch(input);
      const url = new URL(input);
      if (url.pathname === "/checkout") {
        const headers = new Headers(response.headers);
        headers.set("cf-cache-status", "HIT");
        headers.set("age", "60");
        return new Response(response.body, { status: response.status, headers });
      }
      return response;
    },
  });

  assert.equal(report.passed, false);
  assert.equal(
    report.failures.some((failure) => failure.includes("served from Cloudflare cache")),
    true,
  );
  assert.equal(
    report.failures.some((failure) => failure.includes("reusable cache age")),
    true,
  );
});
