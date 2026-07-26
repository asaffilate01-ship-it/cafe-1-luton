import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Cafe1 — Our story" },
      { name: "description", content: "Cafe1 is an independent neighbourhood café serving speciality coffee and honest food." },
      { property: "og:title", content: "About Cafe1" },
      { property: "og:description", content: "An independent neighbourhood café serving speciality coffee and honest food." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-5xl font-bold">Our story</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          Cafe1 opened at St Albans Crown Court, AL1 3JW with one simple idea: proper coffee and honest food, served fast. We roast the same blend we've poured since day one, bake our pastries in-house every morning, and put every order together as if it were our own.
        </p>
        <p className="mt-4 text-lg text-muted-foreground">
          Whether you dine in, collect on your way to work, or have one of our drivers bring it to your door — thanks for choosing us.
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}