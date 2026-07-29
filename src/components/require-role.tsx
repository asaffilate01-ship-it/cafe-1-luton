import { useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useSession, useRoles, type Role } from "@/hooks/use-auth";

/**
 * Client-side gate for staff surfaces. This is UX only — the real
 * enforcement lives in RLS policies and role checks inside server functions.
 */
export function RequireRole({
  roles,
  next,
  children,
}: {
  roles: Role[];
  next: string;
  children: React.ReactNode;
}) {
  const { user, loading } = useSession();
  const { has, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/admin/login", search: { next } });
  }, [loading, user, next, navigate]);

  if (loading || (user && rolesLoading)) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Checking access…</div>;
  }
  if (!user) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Redirecting to sign in…</div>;
  }
  if (!roles.some((r) => has(r))) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <p className="font-display text-2xl font-bold">Not authorised</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This area needs {roles.join(" or ")} access. Ask an admin to grant your account a role.
          </p>
          <Link to="/staff" className="mt-5 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
            Back to staff hub
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}