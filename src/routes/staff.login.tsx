import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ChevronLeft, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const search = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/staff/login")({
  validateSearch: search,
  head: () => ({ meta: [
    { title: "Staff sign in — Cafe1" },
    { name: "description", content: "Restricted sign in for Cafe1 staff, kitchen and drivers." },
    { property: "og:title", content: "Staff sign in — Cafe1" },
    { property: "og:description", content: "Restricted sign in for Cafe1 staff, kitchen and drivers." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: StaffLogin,
});

function StaffLogin() {
  const { next } = useSearch({ from: "/staff/login" });
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("Sign in failed");
      const { data: rows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
      if (roleError) throw roleError;
      const roles = (rows ?? []).map((row) => row.role);
      if (!roles.some((role) => role === "staff" || role === "driver" || role === "admin")) {
        await supabase.auth.signOut();
        throw new Error("This account does not have team access.");
      }
      toast.success("Signed in");
      navigate({ to: safeNext ?? (roles.includes("driver") ? "/driver" : "/staff") });
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
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Back to site</Link>
        <section className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-brand">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><Users className="h-6 w-6" /></div>
          <h1 className="mt-4 font-display text-3xl font-bold">Cafe1 staff sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">For staff, kitchen and delivery team accounts.</p>
          {error ? <p role="alert" className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
          <form onSubmit={onSubmit} className="mt-6 space-y-3" aria-busy={busy}>
            <div><label htmlFor="team-email" className="mb-1.5 block text-sm font-medium">Work email</label><input id="team-email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" className="h-11 w-full rounded-xl border border-border bg-background px-4" /></div>
            <div><label htmlFor="team-password" className="mb-1.5 block text-sm font-medium">Password</label><input id="team-password" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="current-password" className="h-11 w-full rounded-xl border border-border bg-background px-4" /></div>
            <Button disabled={busy} className="h-11 w-full rounded-full">{busy ? "Please wait…" : "Sign in as staff"}</Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">Administrator? <Link to="/admin/login" className="font-medium text-primary hover:underline">Use admin sign in</Link></p>
        </section>
      </div>
    </main>
  );
}