import { createFileRoute, redirect } from "@tanstack/react-router";

/** The counter till now lives on its own full-screen app with its own login. */
export const Route = createFileRoute("/admin/pos")({
  head: () => ({
    meta: [
      { title: "Till — Cafe 1 Luton staff" },
      {
        name: "description",
        content: "Staff till redirect for Cafe 1 Luton. The counter till now runs at /till.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Till — Cafe 1 Luton staff" },
      { property: "og:description", content: "Staff till redirect for Cafe 1 Luton." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/till" });
  },
  component: () => null,
});
