import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Download, MonitorCheck, ShieldCheck } from "lucide-react";

/** Temporary internal download page. Remove it after the café PC is commissioned. */
export const Route = createFileRoute("/watcher-download")({
  head: () => ({
    meta: [
      { title: "Deliveroo Watcher Download | Cafe 1 St Albans" },
      {
        name: "description",
        content: "Internal one-click Café 1 Deliveroo-to-KDS watcher download.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: WatcherDownload,
});

function WatcherDownload() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#17231c,#080a09_65%)] px-4 py-10 text-white">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/80 shadow-2xl shadow-black/50">
        <div className="border-b border-white/10 p-6 sm:p-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <MonitorCheck className="h-4 w-4" /> Café PC · Windows
          </span>
          <h1 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-4xl">
            Deliveroo → KDS setup
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
            Download, extract and double-click one file. The installer keeps the watcher running in
            the background whenever the café PC is signed in.
          </p>
          <a
            href="/downloads/cafe1-deliveroo-watcher-windows.zip"
            download
            className="mt-7 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 font-black text-primary-foreground shadow-lg shadow-primary/25 transition hover:brightness-110 active:scale-[0.99] sm:w-auto"
          >
            <Download className="h-5 w-5" /> Download Windows setup
          </a>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
          <Feature
            icon={CheckCircle2}
            title="One guided setup"
            text="Run START-CAFE1-DELIVEROO.cmd, sign into Deliveroo's own page once and wait for Connected."
          />
          <Feature
            icon={ShieldCheck}
            title="No saved password"
            text="Café 1 never reads or stores the Deliveroo device username or password."
          />
          <Feature
            icon={MonitorCheck}
            title="Stays on"
            text="Starts with Windows, runs hidden, restarts automatically and reports health to KDS."
          />
          <Feature
            icon={Download}
            title="Self-contained"
            text="Installs its own verified runtime when needed and uses Microsoft Edge already on the PC."
          />
        </div>

        <div className="border-t border-white/10 bg-white/[0.03] p-6 text-sm leading-relaxed text-white/55 sm:px-8">
          The installer may copy one Café 1 bridge setting to the clipboard. That key authenticates
          this PC to the website; it is not supplied by Deliveroo and is never committed to GitHub.
          Keep the Deliveroo tablet working normally during setup and acceptance testing.
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Download;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="mt-3 font-bold">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-white/50">{text}</p>
    </div>
  );
}
