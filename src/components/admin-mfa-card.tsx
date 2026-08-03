import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Factor = {
  id: string;
  status: string;
  friendly_name?: string | null;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function AdminMfaCard({
  onAssuranceChange,
}: {
  onAssuranceChange: (isAal2: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aal2, setAal2] = useState(false);
  const [factor, setFactor] = useState<Factor | null>(null);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [assurance, factorList] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const nextAal2 = assurance.data?.currentLevel === "aal2";
    const all = (factorList.data?.totp ?? []) as Factor[];
    const verified = all.find((item) => item.status === "verified") ?? null;
    setAal2(nextAal2);
    setFactor(verified);
    setFactors(all.filter((item) => item.status === "verified"));
    setError(assurance.error?.message ?? factorList.error?.message ?? null);
    onAssuranceChange(nextAal2);
    setLoading(false);
  }, [onAssuranceChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function beginEnrollment() {
    setBusy(true);
    setError(null);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const pending of factors?.totp ?? []) {
        if (pending.status !== "verified")
          await supabase.auth.mfa.unenroll({ factorId: pending.id });
      }
      const baseName = label.trim() || "cafe1stalbans.jury.voucher.scheme";
      const taken = new Set(
        (factors?.totp ?? []).map((f) => (f as { friendly_name?: string }).friendly_name ?? ""),
      );
      // Supabase rejects duplicate friendly names (e.g. an older "Cafe 1 manager"
      // factor that is still verified), so pick a free variant.
      let friendlyName = baseName;
      let n = 2;
      while (taken.has(friendlyName)) friendlyName = `${baseName}.${n++}`;
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });
      if (enrollError) throw enrollError;
      setEnrollment({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start MFA setup");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factorId: string) {
    setBusy(true);
    setError(null);
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
      if (unenrollError) throw unenrollError;
      await supabase.auth.refreshSession();
      toast.success("Authenticator removed");
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not remove that authenticator (verify a current code first)",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    const factorId = enrollment?.factorId ?? factor?.id;
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;
      await supabase.auth.refreshSession();
      setEnrollment(null);
      setCode("");
      toast.success("Manager MFA verified");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The verification code was rejected");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${aal2 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}
          >
            {aal2 ? <CheckCircle2 className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="font-display text-xl font-bold">Manager multi-factor authentication</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {aal2
                ? "This session is verified at AAL2 and can perform sensitive manager actions."
                : factor
                  ? "Enter the current code from your authenticator app to unlock manager actions."
                  : "Connect an authenticator app before accessing security, stocktake and site controls."}
            </p>
          </div>
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {!loading && factors.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {factors.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate text-sm font-medium">
                {item.friendly_name || "Authenticator"}
              </span>
              <button
                type="button"
                disabled={busy || !aal2}
                onClick={() => void removeFactor(item.id)}
                title={aal2 ? "Remove this authenticator" : "Verify a code first to remove"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && !enrollment && (aal2 || !factor) && (
        <div className="mt-4 flex max-w-xl flex-wrap items-center gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (e.g. jury officer – Sam)"
            aria-label="Authenticator label"
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void beginEnrollment()}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : factors.length ? (
              <Plus className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {factors.length ? "Add another authenticator" : "Set up authenticator"}
          </button>
        </div>
      )}

      {enrollment && (
        <div className="mt-5 grid gap-5 rounded-xl border border-border bg-background p-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <img
            src={enrollment.qrCode}
            alt="QR code for Cafe 1 manager authenticator setup"
            className="h-44 w-44 rounded-lg bg-white p-2"
          />
          <div>
            <p className="font-semibold">Scan this QR code in your authenticator app</p>
            <p className="mt-1 text-sm text-muted-foreground">
              If scanning is unavailable, copy the setup key and add it manually.
            </p>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(enrollment.secret);
                toast.success("Setup key copied");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-mono text-xs"
            >
              <Copy className="h-4 w-4" /> {enrollment.secret}
            </button>
          </div>
        </div>
      )}

      {!loading && !aal2 && (factor || enrollment) && (
        <div className="mt-4 flex max-w-md gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Six-digit authenticator code"
            placeholder="000000"
            className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 font-mono text-lg tracking-[.3em]"
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={() => void verify()}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
    </section>
  );
}
