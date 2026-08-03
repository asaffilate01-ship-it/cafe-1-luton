import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Inline "Forgot password?" trigger that emails a reset link. */
export function ForgotPassword({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    const target = (value || email).trim();
    if (!target) {
      toast.error("Enter your email address first");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent — check your email");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not send the reset email");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(email);
          setOpen(true);
        }}
        className="text-sm font-medium text-primary hover:underline"
      >
        Forgot password?
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
      {sent ? (
        <p className="text-sm text-muted-foreground">
          If that address has an account, a reset link is on its way. Open it on this device to set a
          new password.
        </p>
      ) : (
        <>
          <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium">
            Email for the reset link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="reset-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-background px-4"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void send()}
              className="h-11 shrink-0 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send link"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
