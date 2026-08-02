import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { createReleaseHealthResponse } = await import("@/lib/release-health.server");
        return createReleaseHealthResponse();
      },
    },
  },
});
