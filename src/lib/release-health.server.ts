import { PRIVATE_CACHE_HEADERS } from "./private-cache";

const RELEASE_PATTERN = /^[0-9a-f]{40}$/i;

export function createReleaseHealthPayload(env: NodeJS.ProcessEnv = process.env) {
  const supplied = String(env.PUBLIC_RELEASE_SHA ?? "").trim();
  return {
    status: "ok" as const,
    service: "cafe1-st-albans" as const,
    postcode: "AL1 3JU" as const,
    release: RELEASE_PATTERN.test(supplied) ? supplied.toLowerCase() : "unconfigured",
  };
}

export function createReleaseHealthResponse(env: NodeJS.ProcessEnv = process.env) {
  return Response.json(createReleaseHealthPayload(env), {
    headers: PRIVATE_CACHE_HEADERS,
  });
}
