import { createFileRoute } from "@tanstack/react-router";

/**
 * Removes website orders left unpaid for more than 5 minutes.
 * Safe to call publicly: it can only delete abandoned unpaid baskets.
 */
export const Route = createFileRoute("/api/public/cleanup-unpaid")({
  server: {
    handlers: {
      POST: async () => {
        const { purgeStaleUnpaidOrders } = await import("@/lib/order-cleanup.server");
        const removed = await purgeStaleUnpaidOrders();
        return Response.json({ ok: true, removed });
      },
      GET: async () => {
        const { purgeStaleUnpaidOrders } = await import("@/lib/order-cleanup.server");
        const removed = await purgeStaleUnpaidOrders();
        return Response.json({ ok: true, removed });
      },
    },
  },
});