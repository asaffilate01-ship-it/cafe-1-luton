import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { askConfirm } from "@/lib/confirm";
import { AdminNav } from "@/components/admin-nav";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ShieldCheck, UserCog, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Users & roles — Cafe1 admin" },
      { name: "description", content: "Grant staff, driver, and admin access." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsersAdmin,
});

type Role = "admin" | "staff" | "driver" | "customer";
const ASSIGNABLE: Role[] = ["admin", "staff", "driver"];

type Row = {
  id: string;
  email: string | null;
  full_name: string | null;
  roles: Role[];
};

function UsersAdmin() {
  const { user, loading } = useSession();
  const { has, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next: "/admin/users" } });
  }, [loading, user, navigate]);

  const load = useCallback(async () => {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("created_at", { ascending: false });
    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, Role[]>();
    for (const r of allRoles ?? []) {
      const list = map.get(r.user_id) ?? [];
      list.push(r.role as Role);
      map.set(r.user_id, list);
    }
    setRows((profs ?? []).map((p) => ({ ...p, roles: map.get(p.id) ?? ["customer"] })));
  }, []);

  useEffect(() => {
    if (user && has("admin")) load();
  }, [user, has, load]);

  async function grant(userId: string, r: Role) {
    setBusy(true);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: r });
    setBusy(false);
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    toast.success(`Granted ${r}`);
    load();
  }
  async function revoke(userId: string, r: Role) {
    if (r === "admin" && userId === user?.id)
      return toast.error("You can't remove your own admin role.");
    if (
      !(await askConfirm({
        title: `Remove the ${r} role?`,
        description: "This user will immediately lose access to anything that role unlocks.",
        confirmLabel: "Remove role",
      }))
    )
      return;
    setBusy(true);
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", r);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Removed ${r}`);
    load();
  }
  async function grantByEmail() {
    const q = email.trim().toLowerCase();
    if (!q) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", q)
      .maybeSingle();
    if (!prof) return toast.error("No user with that email. They must sign up first at /auth.");
    await grant(prof.id, role);
    setEmail("");
  }

  if (loading || rolesLoading)
    return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (!has("admin"))
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <p className="mt-4 font-semibold">Admins only</p>
        <p className="text-sm text-muted-foreground">
          Only accounts with the admin role can manage users.
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <AdminNav />
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <UserCog className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-3xl font-bold">Users & roles</h1>
            <p className="text-sm text-muted-foreground">
              Grant staff, driver or admin access to any signed-up user.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold">Grant a role by email</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              className="h-11 flex-1 min-w-[220px] rounded-full border border-border bg-background px-4 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="h-11 rounded-full border border-border bg-background px-4 text-sm"
            >
              {ASSIGNABLE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={grantByEmail}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Grant
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            User must have already signed up at /auth (or been created as a tab customer).
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Roles</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3">
                    <p className="font-medium">{r.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {r.roles.map((rl) => (
                        <span
                          key={rl}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${rl === "admin" ? "bg-primary text-primary-foreground" : rl === "staff" ? "bg-primary-soft text-primary" : rl === "driver" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          {rl}
                          {ASSIGNABLE.includes(rl) && (
                            <button
                              onClick={() => revoke(r.id, rl)}
                              className="opacity-70 hover:opacity-100"
                              aria-label={`Remove ${rl}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      {ASSIGNABLE.filter((rl) => !r.roles.includes(rl)).map((rl) => (
                        <button
                          key={rl}
                          disabled={busy}
                          onClick={() => grant(r.id, rl)}
                          className="rounded-full border border-border px-2 py-1 text-xs font-semibold hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                          + {rl}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
