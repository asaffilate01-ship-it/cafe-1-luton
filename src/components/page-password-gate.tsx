import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { PasswordField } from "@/components/password-field";

const PASSWORD = "AL13JU";

/**
 * Lightweight shared-password gate for the juror information pages.
 * This is a courtesy screen for court-facing material, not authentication —
 * real juror data stays behind Juror ID + PIN checks on the server.
 */
export function PagePasswordGate({
  storageKey,
  children,
}: {
  storageKey: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(storageKey) === "1");
    } catch {
      /* storage unavailable */
    }
    setReady(true);
  }, [storageKey]);

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim().toUpperCase() === PASSWORD) {
            try {
              sessionStorage.setItem(storageKey, "1");
            } catch {
              /* storage unavailable */
            }
            setUnlocked(true);
          } else {
            setError(true);
          }
        }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-brand"
      >
        <div className="mb-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-black">Private page</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the password to continue.</p>
        <div className="mt-6">
          <PasswordField
            label="Password"
            value={value}
            minLength={1}
            onChange={(next) => {
              setValue(next);
              setError(false);
            }}
          />
        </div>
        {error && <p className="mt-2 text-sm text-destructive">Incorrect password.</p>}
        <button className="mt-5 h-12 w-full rounded-full bg-primary font-semibold text-primary-foreground shadow-brand">
          Continue
        </button>
      </form>
    </div>
  );
}
