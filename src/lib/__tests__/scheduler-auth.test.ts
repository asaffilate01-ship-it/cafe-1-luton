import { afterEach, describe, expect, it } from "vitest";

import { requireSchedulerAuth, schedulerDate } from "../scheduler-auth.server";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

function captureResponse(action: () => void): Response {
  try {
    action();
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
  throw new Error("Expected the action to reject with a Response");
}

describe("scheduler authentication", () => {
  it("fails closed when the scheduler secret is not configured", () => {
    delete process.env.CRON_SECRET;
    const response = captureResponse(() =>
      requireSchedulerAuth(new Request("https://cafe1stalbans.co.uk/api/public/juror-daily")),
    );
    expect(response.status).toBe(503);
  });

  it("rejects an incorrect bearer secret", () => {
    process.env.CRON_SECRET = "correct-secret-with-at-least-32-characters";
    const response = captureResponse(() =>
      requireSchedulerAuth(
        new Request("https://cafe1stalbans.co.uk/api/public/juror-daily", {
          headers: { authorization: "Bearer incorrect-secret" },
        }),
      ),
    );
    expect(response.status).toBe(401);
  });

  it("accepts the configured bearer secret", () => {
    process.env.CRON_SECRET = "correct-secret-with-at-least-32-characters";
    expect(() =>
      requireSchedulerAuth(
        new Request("https://cafe1stalbans.co.uk/api/public/juror-daily", {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        }),
      ),
    ).not.toThrow();
  });

  it("accepts the compatibility cron header", () => {
    process.env.CRON_SECRET = "correct-secret-with-at-least-32-characters";
    expect(() =>
      requireSchedulerAuth(
        new Request("https://cafe1stalbans.co.uk/api/public/cleanup-unpaid", {
          headers: { "x-cron-secret": process.env.CRON_SECRET! },
        }),
      ),
    ).not.toThrow();
  });
});

describe("scheduler dates", () => {
  it("defaults to today in UTC and rejects arbitrary dates", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(schedulerDate(new Request("https://cafe1stalbans.co.uk/api/public/juror-daily"))).toBe(
      today,
    );

    const response = captureResponse(() =>
      schedulerDate(
        new Request("https://cafe1stalbans.co.uk/api/public/juror-daily?date=2099-01-01"),
      ),
    );
    expect(response.status).toBe(400);
  });
});
