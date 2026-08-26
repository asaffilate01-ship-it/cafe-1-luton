import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ChevronLeft, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PasswordField } from "@/components/password-field";
import { ForgotPassword } from "@/components/forgot-password";

const search = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/team-login")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Staff sign in — Cafe1" },
      { name: "description", content: "Restricted sign in for Cafe1 staff and kitchen teams." },
      { property: "og:title", content: "Staff sign in — Cafe1" },
      {
        property: "og:description",
        content: "Restricted sign in for Cafe1 staff and kitchen teams.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StaffLogin,
});

function StaffLogin() {
  const { next } = useSearch({ from: "/team-login" });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const safeNext = next && /^\/(?:staff|till|kds|admin)(?:\/|$)/.test(next) ? next : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("Sign in failed");
      const { data: rows, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      if (roleError) throw roleError;
      const roles = (rows ?? []).map((row) => row.role);
      if (!roles.some((role) => role === "staff" || role === "admin")) {
        await supabase.auth.signOut();
        throw new Error("This account does not have team access.");
      }
      const isAdmin = roles.includes("admin");
      const assignedSiteId = data.user.app_metadata?.site_id;
      if (!isAdmin && (typeof assignedSiteId !== "string" || !assignedSiteId)) {
        await supabase.auth.signOut();
        throw new Error(
          "No branch is assigned to this staff account. Ask an admin to choose Crown Court or Futures House under Users & roles.",
        );
      }
      toast.success(
        isAdmin ? "Admin access — both branches available" : "Signed in to your assigned branch",
      );
      navigate({ to: safeNext ?? "/staff" });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Sign in failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to site
        </Link>
        <section className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-brand">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Cafe1 staff sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">For staff and kitchen team accounts.</p>
          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-6 space-y-3" aria-busy={busy}>
            <div>
              <label htmlFor="team-email" className="mb-1.5 block text-sm font-medium">
                Work email
              </label>
              <input
                id="team-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 w-full rounded-xl border border-border bg-background px-4"
              />
            </div>
            <PasswordField id="team-password" value={password} onChange={setPassword} />
            <Button disabled={busy} className="h-11 w-full rounded-full">
              {busy ? "Please wait…" : "Sign in as staff"}
            </Button>
          </form>
          <div className="mt-3">
            <ForgotPassword email={email} />
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Administrator?{" "}
            <Link to="/admin/login" className="font-medium text-primary hover:underline">
              Use admin sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
