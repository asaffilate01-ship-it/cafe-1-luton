import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

import { SiteHeader } from "@/components/site-header";
import { toast } from "sonner";
import { PasswordField } from "@/components/password-field";
import { ForgotPassword } from "@/components/forgot-password";

const search = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Sign in — Café 1 Luton" },
      {
        name: "description",
        content: "Sign in or create an account to order from Café 1 Luton.",
      },
      { property: "og:title", content: "Sign in — Café 1 Luton" },
      {
        property: "og:description",
        content: "Sign in or create an account to order from Café 1 Luton.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = () => navigate({ to: next && next.startsWith("/") ? (next as string) : "/" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      go();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Auth failed";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-brand">
          <h1 className="font-display text-3xl font-bold">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Order faster and track your deliveries.
          </p>
          <div className="mt-6" />

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <form onSubmit={onSubmit} className="space-y-3" aria-busy={busy}>
            {mode === "signup" && (
              <div>
                <label htmlFor="customer-name" className="mb-1.5 block text-sm font-medium">
                  Full name
                </label>
                <input
                  id="customer-name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-11 w-full rounded-xl border border-border bg-background px-4"
                />
              </div>
            )}
            <div>
              <label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium">
                Email
              </label>
              <input
                id="customer-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full rounded-xl border border-border bg-background px-4"
              />
            </div>
            <PasswordField
              id="customer-password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            <button
              disabled={busy}
              className="h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand transition hover:bg-primary-hover disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          {mode === "signin" && (
            <div className="mt-3">
              <ForgotPassword email={email} />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setError("");
              setMode(mode === "signin" ? "signup" : "signin");
            }}
            className="mt-4 w-full text-sm text-muted-foreground hover:text-primary"
          >
            {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
          <div className="mt-4 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Staff member?{" "}
            <a href="/admin/login" className="font-medium text-primary hover:underline">
              Sign in here
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
