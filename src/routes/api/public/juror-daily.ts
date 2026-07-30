import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly juror voucher job: expires finished codes and emails the daily
 * HMCTS claim summary. Called by the scheduler; returns counts only.
 */
export const Route = createFileRoute("/api/public/juror-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") ?? undefined;
        const { runJurorDailyJob } = await import("@/lib/juror-daily.server");
        return Response.json({ ok: true, ...(await runJurorDailyJob(date)) });
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const date = url.searchParams.get("date") ?? undefined;
        const { runJurorDailyJob } = await import("@/lib/juror-daily.server");
        return Response.json({ ok: true, ...(await runJurorDailyJob(date)) });
      },
    },
  },
});