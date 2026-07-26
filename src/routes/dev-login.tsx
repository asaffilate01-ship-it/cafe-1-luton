import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureDevAccounts, listDevAccounts } from "@/lib/dev-login.functions";
import { toast } from "sonner";
import { KeyRound, LogIn, ShieldCheck, Truck, User, UtensilsCrossed, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/dev-login")({
  head: () => ({
    meta: [
      { title: "Dev logins — Cafe1" },
      { name: "description", content: "One-click sign-in for every role while testing." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DevLoginPage,
});

const ICONS: Record<string, typeof ShieldCheck> = {
  admin: ShieldCheck,
  staff: UtensilsCrossed,
  driver: Truck,
  customer: User,
};

const DEST: Record<string, string> = {
  admin: "/admin",
  staff: "/staff",
  driver: "/driver",
  customer: "/account",
};

type Account = { email: string; password: string; name: string; role: string };

function DevLoginPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listDevAccounts);
  const ensureFn = useServerFn(ensureDevAccounts);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [signingIn, setSigningIn] = useState<string | null>(null);

  useEffect(() => {
    listFn().then(setAccounts).catch(() => setAccounts([]));
  }, [listFn]);

  async function seed() {
    setSeeding(true);
    try {
      const { results } = await ensureFn();
      const failed = results.filter((r) => r.status.includes("error"));
      if (failed.length) toast.error(`Some accounts failed: ${failed.map((f) => f.email).join(", ")}`);
      else toast.success("Dev accounts ready — pick a role to sign in.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed accounts");
    } finally {
      setSeeding(false);
    }
  }

  async function signIn(acct: Account) {
    setSigningIn(acct.role);
    try {
      // Sign out any existing session first so role gates re-evaluate cleanly
      await supabase.auth.signOut();
      let { error } = await supabase.auth.signInWithPassword({ email: acct.email, password: acct.password });
      if (error) {
        // Auto-seed on first use, then retry once
        toast.message("Provisioning dev accounts…");
        await ensureFn();
        ({ error } = await supabase.auth.signInWithPassword({ email: acct.email, password: acct.password }));
      }
      if (error) throw error;
      toast.success(`Signed in as ${acct.role}`);
      navigate({ to: DEST[acct.role] ?? "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setSigningIn(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Dev logins</h1>
            <p className="text-sm text-muted-foreground">
              One-click sign-in for every role. For testing only — not linked from the site.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Provision accounts</p>
              <p className="text-xs text-muted-foreground">
                Creates / resets four test users with confirmed emails and the correct roles.
              </p>
            </div>
            <button
              onClick={seed}
              disabled={seeding}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <RefreshCcw className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
              {seeding ? "Provisioning…" : "Seed / reset dev users"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => {
            const Icon = ICONS[a.role] ?? User;
            return (
              <div key={a.role} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold capitalize">{a.role}</p>
                    <p className="text-xs text-muted-foreground">{a.name}</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-2"><dt>Email</dt><dd className="font-mono text-foreground">{a.email}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Password</dt><dd className="font-mono text-foreground">{a.password}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Lands on</dt><dd className="font-mono text-foreground">{DEST[a.role]}</dd></div>
                </dl>
                <button
                  onClick={() => signIn(a)}
                  disabled={signingIn !== null}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" />
                  {signingIn === a.role ? "Signing in…" : `Sign in as ${a.role}`}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prefer to sign in manually? Head to <Link to="/auth" className="underline">/auth</Link> or <Link to="/admin/login" className="underline">/admin/login</Link>.
        </p>
      </div>
    </div>
  );
}