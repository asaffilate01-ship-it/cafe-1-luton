import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyTabCode } from "@/lib/accounts.functions";
import { SiteHeader } from "@/components/site-header";
import { tab, useTab } from "@/lib/tab";
import { toast } from "sonner";
import { ReceiptText, LogOut } from "lucide-react";

export const Route = createFileRoute("/tab")({
  head: () => ({
    meta: [
      { title: "Tab sign-in — Cafe1" },
      { name: "description", content: "Enter your business tab code to order on account at Cafe1." },
      { property: "og:title", content: "Tab sign-in — Cafe1" },
      { property: "og:description", content: "Enter your business tab code to order on account at Cafe1." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TabPage,
});

function TabPage() {
  const navigate = useNavigate();
  const current = useTab();
  const verify = useServerFn(verifyTabCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await verify({ data: { code } });
      if (!res.ok) { toast.error("That code isn't recognised."); return; }
      tab.set({ account_id: res.account_id, name: res.name, code: res.code });
      toast.success(`Signed in — ${res.name}'s tab`);
      navigate({ to: "/menu" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-brand">
          <div className="mb-6 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <ReceiptText className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-bold">Business tab sign-in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the access code we gave your team. Orders you place will be added to your running bill and settled together.
          </p>
          {current ? (
            <div className="mt-6 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
              <p className="font-semibold text-primary">Signed in as {current.name}</p>
              <p className="mt-1 text-muted-foreground">Code: <span className="font-mono">{current.code}</span></p>
              <div className="mt-3 flex gap-2">
                <Link to="/menu" className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground">Start ordering</Link>
                <button type="button" onClick={() => { tab.clear(); toast.message("Signed out of tab"); }} className="inline-flex h-10 items-center justify-center gap-1 rounded-full border border-border px-4 text-sm font-semibold hover:border-primary hover:text-primary">
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3">
              <input
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ACCESS CODE"
                className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-center font-mono text-2xl tracking-[0.3em]"
              />
              <button disabled={busy} className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand disabled:opacity-60">
                {busy ? "Checking…" : "Sign in"}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Don't have a tab? <Link to="/contact" className="font-semibold text-primary underline">Ask us to set one up.</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}