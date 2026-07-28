import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { isDevHost } from "./dev-env";

type Role = "admin" | "staff" | "driver" | "customer";

const ACCOUNTS: { email: string; password: string; name: string; role: Role }[] = [
  { email: "dev-admin@cafe1.test",    password: "DevAdmin!2026",    name: "Dev Admin",    role: "admin" },
  { email: "dev-staff@cafe1.test",    password: "DevStaff!2026",    name: "Dev Staff",    role: "staff" },
  { email: "dev-driver@cafe1.test",   password: "DevDriver!2026",   name: "Dev Driver",   role: "driver" },
  { email: "dev-customer@cafe1.test", password: "DevCustomer!2026", name: "Dev Customer", role: "customer" },
];

function assertDevEnvironment() {
  const host = getRequestHeader("host") ?? getRequestHeader("x-forwarded-host");
  if (!isDevHost(host)) {
    throw new Error("Dev logins are disabled on this environment.");
  }
}

export const listDevAccounts = createServerFn({ method: "GET" }).handler(async () => {
  assertDevEnvironment();
  return ACCOUNTS.map(({ email, password, name, role }) => ({ email, password, name, role }));
});

export const ensureDevAccounts = createServerFn({ method: "POST" }).handler(async () => {
  assertDevEnvironment();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: { email: string; role: Role; status: string }[] = [];

  for (const acct of ACCOUNTS) {
    // Find existing user by email
    let userId: string | null = null;
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) {
      results.push({ email: acct.email, role: acct.role, status: `list error: ${listErr.message}` });
      continue;
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === acct.email.toLowerCase());

    if (existing) {
      userId = existing.id;
      // Reset password + confirm email so login always works
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: acct.password,
        email_confirm: true,
        user_metadata: { full_name: acct.name },
      });
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: acct.email,
        password: acct.password,
        email_confirm: true,
        user_metadata: { full_name: acct.name },
      });
      if (createErr || !created.user) {
        results.push({ email: acct.email, role: acct.role, status: `create error: ${createErr?.message ?? "unknown"}` });
        continue;
      }
      userId = created.user.id;
    }

    // Ensure profile row
    await supabaseAdmin.from("profiles").upsert(
      { id: userId, email: acct.email, full_name: acct.name },
      { onConflict: "id" },
    );

    // Ensure role assignment
    if (acct.role !== "customer") {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: acct.role },
        { onConflict: "user_id,role" },
      );
    }

    results.push({ email: acct.email, role: acct.role, status: existing ? "updated" : "created" });
  }

  return { results };
});