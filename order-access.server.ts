import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { isDevHost } from "./dev-env";

type Role = "admin" | "staff" | "driver" | "customer";
type DevAccount = { email: string; password: string; name: string; role: Role };

const ROLE_CONFIG: Array<{
  role: Role;
  name: string;
  emailKey: string;
  passwordKey: string;
}> = [
  {
    role: "admin",
    name: "Dev Admin",
    emailKey: "DEV_ADMIN_EMAIL",
    passwordKey: "DEV_ADMIN_PASSWORD",
  },
  {
    role: "staff",
    name: "Dev Staff",
    emailKey: "DEV_STAFF_EMAIL",
    passwordKey: "DEV_STAFF_PASSWORD",
  },
  {
    role: "driver",
    name: "Dev Driver",
    emailKey: "DEV_DRIVER_EMAIL",
    passwordKey: "DEV_DRIVER_PASSWORD",
  },
  {
    role: "customer",
    name: "Dev Customer",
    emailKey: "DEV_CUSTOMER_EMAIL",
    passwordKey: "DEV_CUSTOMER_PASSWORD",
  },
];

function assertDevEnvironment() {
  const host = getRequestHeader("host") ?? getRequestHeader("x-forwarded-host");
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_DEV_LOGIN !== "true" ||
    !isDevHost(host)
  ) {
    throw new Error("Dev logins are disabled on this environment.");
  }
}

function configuredAccounts(): DevAccount[] {
  return ROLE_CONFIG.flatMap((config) => {
    const email = process.env[config.emailKey]?.trim();
    const password = process.env[config.passwordKey] ?? "";
    if (!email || password.length < 12) return [];
    return [{ email, password, name: config.name, role: config.role }];
  });
}

export const listDevAccounts = createServerFn({ method: "GET" }).handler(async () => {
  assertDevEnvironment();
  return configuredAccounts();
});

export const ensureDevAccounts = createServerFn({ method: "POST" }).handler(async () => {
  assertDevEnvironment();
  const accounts = configuredAccounts();
  if (!accounts.length) throw new Error("No DEV_* accounts are configured.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw new Error(listError.message);

  const results: { email: string; role: Role; status: string }[] = [];
  for (const account of accounts) {
    const existing = list.users.find(
      (user) => user.email?.toLowerCase() === account.email.toLowerCase(),
    );
    let userId: string;
    if (existing) {
      userId = existing.id;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      });
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.name },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Could not create dev user");
      userId = created.user.id;
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: account.email, full_name: account.name }, { onConflict: "id" });
    if (account.role !== "customer") {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: account.role }, { onConflict: "user_id,role" });
    }
    results.push({
      email: account.email,
      role: account.role,
      status: existing ? "updated" : "created",
    });
  }
  return { results };
});
