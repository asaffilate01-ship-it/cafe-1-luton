import { timingSafeEqual } from "node:crypto";

function sameSecret(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Protects scheduler endpoints with a server-only, high-entropy bearer secret. */
export function requireSchedulerAuth(request: Request): void {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 32) {
    throw new Response("Scheduler is not configured", { status: 503 });
  }
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : (request.headers.get("x-cron-secret") ?? "");
  if (!sameSecret(provided, expected)) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

/** Scheduler dates may be today only; arbitrary future dates can expire data. */
export function schedulerDate(request: Request): string {
  const today = new Date().toISOString().slice(0, 10);
  const supplied = new URL(request.url).searchParams.get("date");
  if (!supplied) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(supplied) || supplied !== today) {
    throw new Response("date must be today in UTC", { status: 400 });
  }
  return supplied;
}
