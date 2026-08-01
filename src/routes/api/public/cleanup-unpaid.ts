import { createFileRoute } from "@tanstack/react-router";

/**
 * Removes website orders left unpaid for more than 5 minutes.
 * Scheduler-only: requires the CRON_SECRET bearer.
 */
async function run(request: Request) {
  const { requireSchedulerAuth } = await import("@/lib/scheduler-auth.server");
  try {
    requireSchedulerAuth(request);
    const { purgeStaleUnpaidOrders } = await import("@/lib/order-cleanup.server");
    return Response.json({ ok: true, removed: await purgeStaleUnpaidOrders() });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export const Route = createFileRoute("/api/public/cleanup-unpaid")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});