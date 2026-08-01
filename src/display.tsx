import { createFileRoute } from "@tanstack/react-router";

/**
 * Reconciles stale unpaid orders. Scheduler bearer authentication is required.
 */
export const Route = createFileRoute("/api/public/cleanup-unpaid")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireSchedulerAuth } = await import("@/lib/scheduler-auth.server");
        requireSchedulerAuth(request);
        const { purgeStaleUnpaidOrders } = await import("@/lib/order-cleanup.server");
        const removed = await purgeStaleUnpaidOrders();
        return Response.json({ ok: true, removed });
      },
    },
  },
});
