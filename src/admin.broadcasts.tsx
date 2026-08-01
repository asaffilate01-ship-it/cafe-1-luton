import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { signOutAndRedirect } from "@/lib/sign-out";
import { toast } from "sonner";
import { ShieldCheck, ChevronLeft } from "lucide-react";

const search = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/admin/login")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Staff sign in — Cafe1" },
      { name: "description", content: "Restricted sign in for Cafe1 staff, kitchen and drivers." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const { next } = useSearch({ from: "/admin/login" });
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const { roles, has, loading: rolesLoading } = useRoles(user);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function homeForRoles(rs: string[]) {
    if (rs.includes("admin") || rs.includes("staff")) return "/staff";
    if (rs.includes("driver")) return "/driver";
    return "/staff";
  }
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const dest = safeNext ?? homeForRoles(roles);

  const alreadyStaff =
    !loading && !rolesLoading && !!user && (has("admin") || has("staff") || has("driver"));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("Sign in failed");

      const { data: rows, error: rErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (rErr) throw rErr;
      const rs = (rows ?? []).map((r) => r.role);
      const allowed = rs.includes("admin") || rs.includes("staff") || rs.includes("driver");
      if (!allowed) {
        await supabase.auth.signOut();
        throw new Error("This account has no staff access.");
      }
      toast.success("Signed in");
      navigate({ to: safeNext ?? homeForRoles(rs) });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary-soft/40">
      <div className="mx-auto max-w-md px-4 py-16">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to site
        </Link>
        {alreadyStaff && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-brand">
            <p className="text-sm">
              Already signed in as <span className="font-semibold">{user?.email}</span>
              {roles.length ? ` (${roles.join(", ")})` : ""}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => navigate({ to: dest })}
                className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                Continue
              </button>
              <button
                onClick={() => signOutAndRedirect("/admin/login")}
                className="h-10 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
        <div className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-brand">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Staff sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Restricted to Cafe1 admins, kitchen and drivers.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11 w-full rounded-xl border border-border bg-background px-4"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              className="h-11 w-full rounded-xl border border-border bg-background px-4"
            />
            <button
              disabled={busy}
              className="h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Are you a customer? <Link to="/auth" className="font-medium text-primary hover:underline">Sign in here</Link> to place an order.
          </div>
        </div>
      </div>
    </div>
  );
}