import { createFileRoute } from "@tanstack/react-router";

/**
 * Temporary internal download page for the Deliveroo shop watcher.
 * Not linked from anywhere and marked noindex — delete this file (and
 * public/downloads/cafe1-deliveroo-watcher.zip) once the shop PC is set up.
 */
export const Route = createFileRoute("/watcher-download")({
  head: () => ({
    meta: [
      { title: "Deliveroo Watcher Download | Cafe1 St Albans" },
      {
        name: "description",
        content:
          "Internal download for the Cafe1 Deliveroo Restaurant Hub watcher used on the shop PC.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Deliveroo Watcher Download | Cafe1 St Albans" },
      {
        property: "og:description",
        content: "Internal download for the Cafe1 Deliveroo Hub watcher.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WatcherDownload,
});

function WatcherDownload() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Deliveroo watcher — shop PC download</h1>
      <p className="mt-4 text-muted-foreground">
        Internal use only. Download this on the shop PC next to the Deliveroo tablet, then follow
        the steps below.
      </p>

      <a
        href="/downloads/cafe1-deliveroo-watcher.zip"
        download
        className="mt-8 inline-flex items-center rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground shadow transition hover:opacity-90"
      >
        Download cafe1-deliveroo-watcher.zip
      </a>

      <ol className="mt-10 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
        <li>Install Node.js from nodejs.org (take the LTS button).</li>
        <li>Unzip this file somewhere permanent, for example C:\Cafe1\deliveroo-watcher.</li>
        <li>
          Copy <code>deliveroo-hub-watcher.env.example</code> and rename the copy to{" "}
          <code>deliveroo-hub-watcher.env</code>. Open it in Notepad, fill in the Hub username,
          password and the bridge secret, then save.
        </li>
        <li>
          Right-click <code>install-deliveroo-watcher.ps1</code> and choose{" "}
          <strong>Run with PowerShell</strong>.
        </li>
        <li>
          Within a minute the kitchen display badge turns green, <strong>Deliveroo auto</strong>.
        </li>
      </ol>

      <p className="mt-10 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
        Once it is installed and the badge is green, tell me and I will remove this page and the
        download from the website.
      </p>
    </main>
  );
}
