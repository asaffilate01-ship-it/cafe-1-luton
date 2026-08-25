import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, ShieldCheck, Trash2 } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { RequireRole } from "@/components/require-role";
import { askConfirm } from "@/lib/confirm";
import {
  adminDeleteCourtLocation,
  adminDeleteCourtStaff,
  adminListCourtStaff,
  adminSaveCourtDomain,
  adminSaveCourtLocation,
  adminSaveCourtStaff,
  adminSetStaffDiscount,
} from "@/lib/court-staff.functions";

export const Route = createFileRoute("/admin/court-staff")({
  head: () => ({
    meta: [
      { title: "Court staff scheme — Cafe1 Admin" },
      {
        name: "description",
        content: "Approve court staff, manage court delivery points and the staff discount rate.",
      },
      { property: "og:title", content: "Court staff scheme — Cafe1 Admin" },
      {
        property: "og:description",
        content: "Approve court staff, manage court delivery points and the staff discount rate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireRole roles={["admin"]} next="/admin/court-staff">
      <AdminCourtStaff />
    </RequireRole>
  ),
});

function AdminCourtStaff() {
  const qc = useQueryClient();
  const list = useServerFn(adminListCourtStaff);
  const saveMember = useServerFn(adminSaveCourtStaff);
  const deleteMember = useServerFn(adminDeleteCourtStaff);
  const saveLocation = useServerFn(adminSaveCourtLocation);
  const deleteLocation = useServerFn(adminDeleteCourtLocation);
  const saveDomain = useServerFn(adminSaveCourtDomain);
  const setDiscount = useServerFn(adminSetStaffDiscount);

  const { data } = useQuery({
    queryKey: ["admin-court-staff"],
    queryFn: () => list({ data: undefined }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-court-staff"] });

  const [member, setMember] = useState({ email: "", full_name: "", phone: "" });
  const [location, setLocation] = useState({ label: "", building: "", sort_order: 0 });
  const [domain, setDomain] = useState("");
  const [percent, setPercent] = useState<number | null>(null);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const discountValue = percent ?? data?.default_discount_percent ?? 10;

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <ShieldCheck className="h-6 w-6 text-primary" /> Court staff scheme
          </h1>
          <p className="text-sm text-muted-foreground">
            Approved staff get the discount below plus free delivery to a court location.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Staff discount</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={discountValue}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="h-11 w-28 rounded-xl border border-border bg-background px-4"
            />
            <span className="text-sm text-muted-foreground">% off every staff order</span>
            <button
              onClick={() =>
                void run(
                  () => setDiscount({ data: { percent: discountValue } }),
                  "Staff discount saved",
                )
              }
              className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Save
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Approved email domains</p>
          <p className="text-xs text-muted-foreground">
            Anyone with a verified email on these domains is approved automatically.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(data?.domains ?? []).map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium"
              >
                {d.domain}
                <button
                  aria-label={`Remove ${d.domain}`}
                  onClick={() =>
                    void run(
                      () => saveDomain({ data: { id: d.id, domain: d.domain, remove: true } }),
                      "Domain removed",
                    )
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="justice.gov.uk"
              className="h-11 flex-1 rounded-xl border border-border bg-background px-4"
            />
            <button
              onClick={() =>
                void run(async () => {
                  await saveDomain({ data: { domain: domain.trim() } });
                  setDomain("");
                }, "Domain added")
              }
              className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Add
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Building2 className="h-4 w-4 text-primary" /> Court delivery points
          </p>
          <ul className="mt-3 space-y-2">
            {(data?.locations ?? []).map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
              >
                <span className="text-sm font-semibold">
                  {l.label}
                  {l.building ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {l.building}
                    </span>
                  ) : null}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      void run(
                        () =>
                          saveLocation({
                            data: {
                              id: l.id,
                              label: l.label,
                              building: l.building ?? "",
                              postcode: l.postcode ?? "LU1 2AA",
                              sort_order: l.sort_order ?? 0,
                              active: !l.active,
                            },
                          }),
                        l.active ? "Location hidden" : "Location shown",
                      )
                    }
                    className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
                  >
                    {l.active ? "Active" : "Hidden"}
                  </button>
                  <button
                    aria-label={`Delete ${l.label}`}
                    onClick={async () => {
                      if (!(await askConfirm(`Delete ${l.label}?`))) return;
                      await run(() => deleteLocation({ data: { id: l.id } }), "Location deleted");
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_2fr_1fr_auto]">
            <input
              value={location.label}
              onChange={(e) => setLocation({ ...location, label: e.target.value })}
              placeholder="CC Floor 1"
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <input
              value={location.building}
              onChange={(e) => setLocation({ ...location, building: e.target.value })}
              placeholder="Crown Court"
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <input
              type="number"
              value={location.sort_order}
              onChange={(e) => setLocation({ ...location, sort_order: Number(e.target.value) })}
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <button
              onClick={() =>
                void run(async () => {
                  await saveLocation({
                    data: {
                      label: location.label.trim(),
                      building: location.building.trim(),
                      postcode: "LU1 2AA",
                      sort_order: location.sort_order,
                      active: true,
                    },
                  });
                  setLocation({ label: "", building: "", sort_order: 0 });
                }, "Location added")
              }
              className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Add
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold">Members</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_2fr_1.5fr_auto]">
            <input
              value={member.full_name}
              onChange={(e) => setMember({ ...member, full_name: e.target.value })}
              placeholder="Full name"
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <input
              value={member.email}
              onChange={(e) => setMember({ ...member, email: e.target.value })}
              placeholder="name@justice.gov.uk"
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <input
              value={member.phone}
              onChange={(e) => setMember({ ...member, phone: e.target.value })}
              placeholder="Phone"
              className="h-11 rounded-xl border border-border bg-background px-4"
            />
            <button
              onClick={() =>
                void run(async () => {
                  await saveMember({
                    data: {
                      email: member.email.trim(),
                      full_name: member.full_name.trim(),
                      phone: member.phone.trim(),
                      status: "approved",
                    },
                  });
                  setMember({ email: "", full_name: "", phone: "" });
                }, "Member approved")
              }
              className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Add &amp; approve
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {(data?.members ?? []).map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{m.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.email}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.status}
                    onChange={(e) =>
                      void run(
                        () =>
                          saveMember({
                            data: {
                              id: m.id,
                              email: m.email,
                              full_name: m.full_name,
                              phone: m.phone ?? "",
                              status: e.target.value as "pending" | "approved" | "suspended",
                              discount_percent: m.discount_percent,
                            },
                          }),
                        "Member updated",
                      )
                    }
                    className="h-10 rounded-xl border border-border bg-card px-3 text-sm font-semibold"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="suspended">Suspended</option>
                  </select>
                  <button
                    aria-label={`Delete ${m.full_name}`}
                    onClick={async () => {
                      if (!(await askConfirm(`Remove ${m.full_name} from the scheme?`))) return;
                      await run(() => deleteMember({ data: { id: m.id } }), "Member removed");
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {(data?.members ?? []).length === 0 && (
              <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No court staff registered yet.
              </li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
