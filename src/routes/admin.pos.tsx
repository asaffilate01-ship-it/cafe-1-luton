import { createFileRoute, redirect } from "@tanstack/react-router";

/** The counter till now lives on its own full-screen app with its own login. */
export const Route = createFileRoute("/admin/pos")({
  beforeLoad: () => {
    throw redirect({ to: "/till" });
  },
  component: () => null,
});
