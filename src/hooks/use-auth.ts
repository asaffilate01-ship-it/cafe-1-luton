import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { cart } from "@/lib/cart";

export type Role = "admin" | "staff" | "driver" | "customer";

type AuthSnapshot = { session: Session | null; loading: boolean };

let authSnapshot: AuthSnapshot = { session: null, loading: true };
const authListeners = new Set<() => void>();
let authStarted = false;
let authRevision = 0;

function publishAuth(session: Session | null, loading = false) {
  authSnapshot = { session, loading };
  cart.syncOwner(session?.user?.id ?? null);
  authListeners.forEach((listener) => listener());
}

function startAuthStore() {
  if (authStarted || typeof window === "undefined") return;
  authStarted = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    authRevision += 1;
    publishAuth(session);
  });

  const revisionAtRequest = authRevision;
  void supabase.auth.getSession().then(({ data }) => {
    // An auth event that arrived while getSession was pending is newer and wins.
    if (revisionAtRequest === authRevision) publishAuth(data.session);
  });
}

function subscribeAuth(listener: () => void) {
  authListeners.add(listener);
  startAuthStore();
  return () => authListeners.delete(listener);
}

function getAuthSnapshot() {
  return authSnapshot;
}

const serverAuthSnapshot: AuthSnapshot = { session: null, loading: true };

function getServerAuthSnapshot() {
  return serverAuthSnapshot;
}

export function useSession() {
  const { session, loading } = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getServerAuthSnapshot,
  );
  return { session, user: session?.user ?? null, loading };
}

export function useRoles(user: User | null) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!active) return;
        setRoles(((data ?? []).map((r) => r.role) as Role[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  return { roles, loading, has: (r: Role) => roles.includes(r) };
}