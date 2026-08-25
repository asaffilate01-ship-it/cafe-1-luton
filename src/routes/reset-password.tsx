import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PasswordField } from "@/components/password-field";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Café 1 Luton" },
      { name: "description", content: "Choose a new password for your Café 1 Luton account." },
      { property: "og:title", content: "Set a new password — Café 1 Luton" },
      {
        property: "og:description",
        content: "Choose a new password for your Café 1 Luton account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setReady(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Password updated");
      navigate({ to: "/", replace: true });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not update the password";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-4 py-16">
        <section className="rounded-3xl border border-border bg-card p-8 shadow-brand">
          <h1 className="font-display text-3xl font-bold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready
              ? "Choose a new password for your account."
              : "Open the reset link from your email on this device to continue."}
          </p>
          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-6 space-y-3" aria-busy={busy}>
            <PasswordField
              id="new-password"
              label="New password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
            <button
              disabled={busy || !ready}
              className="h-11 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand disabled:opacity-60"
            >
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
