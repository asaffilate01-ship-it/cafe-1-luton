import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { signOutAndRedirect } from "@/lib/sign-out";
import { toast } from "sonner";
import { ShieldCheck, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/password-field";
import { ForgotPassword } from "@/components/forgot-password";

const search = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/admin/login")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Admin sign in — Cafe1" },
      {
        name: "description",
        content: "Restricted sign in for Cafe1 administrators.",
      },
      { property: "og:title", content: "Admin sign in — Cafe1" },
      { property: "og:description", content: "Restricted sign in for Cafe1 administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [error, setError] = useState("");

  const safeNext = next && next.startsWith("/admin") && !next.startsWith("//") ? next : null;
  const dest = safeNext ?? "/admin";

  const alreadyAdmin = !loading && !rolesLoading && !!user && has("admin");
  const signedInNotAdmin = !loading && !rolesLoading && !!user && !has("admin");

  // Already an admin? Don't dead-end on a banner — go straight through.
  // Only ever auto-redirect once, so a page that bounces back can't loop.
  const autoWent = useRef(false);
  useEffect(() => {
    if (alreadyAdmin && !busy && !autoWent.current) {
      autoWent.current = true;
      navigate({ to: dest, replace: true });
    }
  }, [alreadyAdmin, busy, dest, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // A stale session from another account blocks a fresh sign in — clear it first.
      if (user) await supabase.auth.signOut();
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
      if (!rs.includes("admin")) {
        await supabase.auth.signOut();
        throw new Error("This account does not have administrator access.");
      }
      toast.success("Signed in");
      navigate({ to: safeNext ?? "/admin" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign in failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary-soft/40">
      <div className="mx-auto max-w-md px-4 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to site
        </Link>
        {alreadyAdmin && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-brand">
            <p className="text-sm">
              Already signed in as <span className="font-semibold">{user?.email}</span>
              {roles.length ? ` (${roles.join(", ")})` : ""}.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => navigate({ to: dest })}
                className="h-10 rounded-full px-5"
              >
                Continue to admin
              </Button>
              <Button
                variant="outline"
                onClick={() => signOutAndRedirect("/admin/login")}
                className="h-10 rounded-full px-5"
              >
                Sign out
              </Button>
            </div>
          </div>
        )}
        {signedInNotAdmin && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5 text-sm shadow-brand">
            You're signed in as <span className="font-semibold">{user?.email}</span>
            {roles.length ? ` (${roles.join(", ")})` : ""}, which isn't an admin account. Sign in
            below with your admin details — we'll swap the session over automatically.
          </div>
        )}
        <div className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-brand">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Cafe1 admin sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administrator access only. Staff should use the separate staff sign-in.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-3" aria-busy={busy}>
            <div>
              <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium">
                Admin email
              </label>
              <input
                id="admin-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                inputMode="email"
                className="h-11 w-full rounded-xl border border-border bg-background px-4"
              />
            </div>
            <PasswordField id="admin-password" value={password} onChange={setPassword} />
            <Button
              disabled={busy}
              className="h-11 w-full rounded-full"
            >
              {busy ? "Please wait…" : "Sign in as admin"}
            </Button>
          </form>
          <div className="mt-3">
            <ForgotPassword email={email} />
          </div>

          <div className="mt-6 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Cafe1 team member?{" "}
            <Link to="/team-login" className="font-medium text-primary hover:underline">
              Use staff sign in
            </Link>{" "}
            instead.
          </div>
        </div>
      </div>
    </div>
  );
}
