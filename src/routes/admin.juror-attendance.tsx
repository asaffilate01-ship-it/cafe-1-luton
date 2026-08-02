import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { RequireRole } from "@/components/require-role";
import { QrCode } from "@/components/qr-code";
import { createJurorAttendanceChallenge } from "@/lib/juror-attendance.functions";
import { toast } from "sonner";
import { Clock3, Loader2, MapPin, QrCode as QrIcon, RefreshCw, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/juror-attendance")({
  head: () => ({
    meta: [{ title: "Jury-room attendance QR — Cafe 1" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <RequireRole roles={["admin", "staff"]} next="/admin/juror-attendance">
      <AttendancePage />
    </RequireRole>
  ),
});
type Challenge = { id: string; room: string; expires_at: string; token: string };
function AttendancePage() {
  const create = useServerFn(createJurorAttendanceChallenge);
  const [room, setRoom] = useState("Other jury room");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = challenge
    ? Math.max(0, Math.ceil((new Date(challenge.expires_at).getTime() - now) / 1000))
    : 0;
  const url = useMemo(
    () =>
      challenge && typeof window !== "undefined"
        ? `${window.location.origin}/juror?attendance=${encodeURIComponent(challenge.token)}`
        : "",
    [challenge],
  );
  async function generate() {
    setBusy(true);
    try {
      setChallenge(await create({ data: { room } }));
      toast.success("One-time attendance QR created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create QR");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
            HMCTS draft control
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">Jury-room attendance QR</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A short-life, one-time challenge. No juror name, case or trial information is stored.
          </p>
        </div>
        <div className="mt-7 grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-border bg-card p-5">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Approved room label
            </label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"
            />
            <button
              disabled={busy || room.trim().length < 2}
              onClick={() => void generate()}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrIcon className="h-4 w-4" />}
              Generate one-time QR
            </button>
            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <p className="flex gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                Expires after 90 seconds.
              </p>
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                Can be consumed only once.
              </p>
              <p className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                Use only at an HMCTS-approved QR location.
              </p>
            </div>
          </section>
          <section className="grid min-h-[420px] place-items-center rounded-2xl border border-border bg-card p-6 text-center">
            {challenge && left > 0 ? (
              <div>
                <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow">
                  <QrCode value={url} size={260} />
                </div>
                <p className="mt-4 font-display text-2xl font-bold">{challenge.room}</p>
                <p className="mt-1 font-semibold text-primary">Expires in {left}s</p>
                <button
                  onClick={() => void generate()}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
                >
                  <RefreshCw className="h-4 w-4" />
                  Rotate now
                </button>
              </div>
            ) : (
              <div>
                <QrIcon className="mx-auto h-16 w-16 text-muted-foreground/30" />
                <p className="mt-4 font-semibold">
                  {challenge ? "QR expired" : "Generate an attendance QR"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The juror scans it with their live camera and confirms their anonymous voucher
                  code.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
