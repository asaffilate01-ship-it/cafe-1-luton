import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/site-header";
import { GatedMenuList } from "@/components/gated-menu-list";
import { useSession } from "@/hooks/use-auth";
import { verifyTabCode } from "@/lib/accounts.functions";
import { tab, useTab } from "@/lib/tab";
import { orderContext } from "@/lib/order-context";
import { Scale, Lock, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/judges-menu")({
  head: () => ({
    meta: [
      { title: "Judges' Only Menu — Café 1, Luton" },
      {
        name: "description",
        content:
          "Private judges' ordering menu at Café 1, Luton Crown Court. Sign in with the shared judges' login and your personal judge code to order on your weekly tab.",
      },
      { property: "og:title", content: "Judges' Only Menu — Café 1, Luton" },
      {
        property: "og:description",
        content: "Gated judges' menu — judge code required. Orders are added to your weekly tab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JudgesMenuPage,
});

function JudgesMenuPage() {
  const { user, loading } = useSession();
  const current = useTab();
  const verify = useServerFn(verifyTabCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Judges see the standard café range; the juror-scheme items stay private.
  const judgeFilter = useCallback((item: { juror_menu: boolean }) => !item.juror_menu, []);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await verify({ data: { code } });
      if (!res.ok) {
        toast.error("Sorry, that judge code isn't recognised. Please check and try again.");
        return;
      }
      tab.set({ account_id: res.account_id, name: res.name, code: res.code });
      toast.success(`Ordering on ${res.name}'s tab`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check that code");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user || !current) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="mx-auto max-w-md px-4 py-14">
          <div className="rounded-3xl border border-border bg-card p-8 shadow-brand">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
              <Lock className="h-6 w-6" />
            </div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-primary">
              Judges' only menu
            </p>
            <h1 className="mt-2 font-display text-3xl font-black">Judges' ordering</h1>
            {!user ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign in first with the shared judges' login provided by the court.
                </p>
                <Link
                  to="/judges"
                  className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground shadow-brand"
                >
                  Go to the judges' sign in
                </Link>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your personal judge code. Everything you order is added to your tab and
                  settled on Friday.
                </p>
                <form onSubmit={submitCode} className="mt-6 space-y-3">
                  <input
                    required
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="JUDGE CODE"
                    className="h-14 w-full rounded-2xl border border-border bg-background px-4 text-center font-mono text-2xl tracking-[0.3em]"
                  />
                  <button
                    disabled={busy}
                    className="h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand disabled:opacity-60"
                  >
                    {busy ? "Checking…" : "Open the Judges' menu"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-primary px-4 py-8 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-black uppercase tracking-widest">
            <Scale className="h-4 w-4" /> Judges' only menu
          </span>
          <h1 className="mt-3 font-display text-4xl font-black leading-tight">
            JUDGES' ONLY MENU — Café 1
          </h1>
          <p className="mt-3 text-primary-foreground/85">
            Ordering on <strong>{current.name}</strong>'s tab. Delivered to chambers or collected at
            the Café 1 counter — everything this week is settled on Friday.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono">{current.code}</span>
            <button
              type="button"
              onClick={() => orderContext.set({ mode: "collection", schedule_mode: "asap" })}
              className="rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
            >
              Collect at Café 1
            </button>
            <button
              type="button"
              onClick={() => orderContext.set({ mode: "dine_in", schedule_mode: "asap" })}
              className="rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
            >
              Dine in
            </button>
            <button
              type="button"
              onClick={() => {
                tab.clear();
                toast.message("Judge code cleared");
              }}
              className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-semibold hover:bg-white/25"
            >
              <LogOut className="h-3.5 w-3.5" /> Change code
            </button>
          </div>
        </div>
      </section>

      <GatedMenuList
        filter={judgeFilter}
        emptyMessage="The menu is being updated. Please order at the Café 1 counter today."
      />
    </div>
  );
}