import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Bell, BellOff, Building2, Clock, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-auth";
import { useWebPush } from "@/hooks/use-web-push";
import {
  getMyCourtStaff,
  listCourtLocations,
  registerCourtStaff,
} from "@/lib/court-staff.functions";

export const Route = createFileRoute("/court-staff")({
  head: () => ({
    meta: [
      { title: "Court staff ordering — Café 1 Luton" },
      {
        name: "description",
        content:
          "Court staff scheme at Café 1 Luton: register with your work email, order to your floor or room, and get staff pricing with free internal delivery.",
      },
      { property: "og:title", content: "Court staff ordering — Café 1 Luton" },
      {
        property: "og:description",
        content:
          "Register with your court email for staff pricing, free internal delivery and order-ready alerts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourtStaffPage,
});

type Member = { id: string; full_name: string; status: string } | null;

function CourtStaffPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const fetchMine = useServerFn(getMyCourtStaff);
  const fetchLocations = useServerFn(listCourtLocations);
  const register = useServerFn(registerCourtStaff);
  const push = useWebPush();

  const [member, setMember] = useState<Member>(null);
  const [discount, setDiscount] = useState(0);
  const [locations, setLocations] = useState<{ id: string; label: string }[]>([]);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setChecked(!loading);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [mine, locs] = await Promise.all([fetchMine({ data: undefined }), fetchLocations()]);
        if (cancelled) return;
        setMember(mine.member as Member);
        setDiscount(mine.discount_percent);
        setLocations(locs.locations.map((l) => ({ id: l.id, label: l.label })));
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, fetchMine, fetchLocations]);

  async function onRegister(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await register({ data: { full_name: fullName.trim(), phone: phone.trim() } });
      setMember({ id: "pending", full_name: fullName.trim(), status: res.status });
      toast.success(
        res.status === "approved"
          ? "You're approved — staff pricing is now active."
          : "Registration received. We'll approve your account shortly.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  const approved = member?.status === "approved";

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold">Court staff ordering</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Register once with your court email address. Approved staff get the staff discount, free
          delivery inside the court estate and alerts when an order is ready.
        </p>

        {!user && !loading && (
          <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-brand">
            <p className="font-semibold">Sign in to continue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your work email (for example @justice.gov.uk) so we can verify your court account.
            </p>
            <Button className="mt-4 h-11 rounded-full" onClick={() => navigate({ to: "/auth" })}>
              Sign in or create an account
            </Button>
          </section>
        )}

        {user && checked && !member && (
          <form
            onSubmit={onRegister}
            className="mt-8 space-y-3 rounded-3xl border border-border bg-card p-6 shadow-brand"
          >
            <p className="font-semibold">Register for the staff scheme</p>
            <div>
              <label htmlFor="cs-name" className="mb-1.5 block text-sm font-medium">
                Full name
              </label>
              <input
                id="cs-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                maxLength={100}
                className="h-11 w-full rounded-xl border border-border bg-background px-4"
              />
            </div>
            <div>
              <label htmlFor="cs-phone" className="mb-1.5 block text-sm font-medium">
                Mobile number
              </label>
              <input
                id="cs-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                maxLength={30}
                className="h-11 w-full rounded-xl border border-border bg-background px-4"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Registered court email domains are approved automatically once your email is verified.
              Everyone else is approved manually by the Café 1 team.
            </p>
            <Button disabled={busy} className="h-11 w-full rounded-full">
              {busy ? "Sending…" : "Register"}
            </Button>
          </form>
        )}

        {member && (
          <section className="mt-8 space-y-4">
            <div
              className={`rounded-3xl border p-6 shadow-brand ${approved ? "border-primary/40 bg-primary/5" : "border-amber-400/60 bg-amber-50"}`}
            >
              <p className="flex items-center gap-2 font-semibold">
                {approved ? (
                  <BadgeCheck className="h-5 w-5 text-primary" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
                {approved ? "Approved court staff" : "Awaiting approval"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {approved
                  ? `${discount}% staff discount and £0.00 delivery are applied automatically at checkout.`
                  : "We'll approve your account shortly — you can still order at normal prices meanwhile."}
              </p>
              {approved && (
                <Button asChild className="mt-4 h-11 rounded-full">
                  <Link to="/menu">Start an order</Link>
                </Button>
              )}
            </div>

            {approved && locations.length > 0 && (
              <div className="rounded-3xl border border-border bg-card p-6">
                <p className="flex items-center gap-2 font-semibold">
                  <Building2 className="h-4 w-4 text-primary" /> Delivery points
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {locations.map((l) => (
                    <li
                      key={l.id}
                      className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold"
                    >
                      {l.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-3xl border border-border bg-card p-6">
              <p className="flex items-center gap-2 font-semibold">
                <Bell className="h-4 w-4 text-primary" /> Order alerts
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Get a notification when your order is ready to collect, or when a delivery is on its
                way to your location.
              </p>
              {!push.supported ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  This device doesn't support notifications — we'll email you instead.
                </p>
              ) : push.enabled ? (
                <Button
                  variant="outline"
                  disabled={push.busy}
                  onClick={() => void push.disable()}
                  className="mt-4 h-11 rounded-full"
                >
                  <BellOff className="mr-2 h-4 w-4" /> Turn off alerts
                </Button>
              ) : (
                <Button
                  disabled={push.busy}
                  onClick={async () => {
                    const res = await push.enable();
                    if (!res.ok) toast.error(res.reason ?? "Couldn't turn on alerts");
                    else toast.success("Alerts on for this device");
                  }}
                  className="mt-4 h-11 rounded-full"
                >
                  <Bell className="mr-2 h-4 w-4" /> Turn on alerts
                </Button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
