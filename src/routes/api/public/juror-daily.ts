import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly juror voucher job: expires finished codes and emails the daily
 * HMCTS claim summary. Scheduler-only: requires the CRON_SECRET bearer and
 * will only ever process today's date.
 */
async function run(request: Request) {
  const { requireSchedulerAuth, schedulerDate } = await import("@/lib/scheduler-auth.server");
  try {
    requireSchedulerAuth(request);
    const date = schedulerDate(request);
    const { runJurorDailyJob } = await import("@/lib/juror-daily.server");
    return Response.json({ ok: true, ...(await runJurorDailyJob(date)) });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export const Route = createFileRoute("/api/public/juror-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async () =>
        new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } }),
    },
  },
});
