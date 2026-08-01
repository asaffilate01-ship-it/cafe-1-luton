import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly juror voucher job: expires finished codes and emails the daily
 * HMCTS claim summary. Called by the scheduler; returns counts only.
 */
export const Route = createFileRoute("/api/public/juror-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireSchedulerAuth, schedulerDate } = await import("@/lib/scheduler-auth.server");
        requireSchedulerAuth(request);
        const date = schedulerDate(request);
        const { runJurorDailyJob } = await import("@/lib/juror-daily.server");
        return Response.json({ ok: true, ...(await runJurorDailyJob(date)) });
      },
    },
  },
});
