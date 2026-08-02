import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSites, type CafeSite } from "@/lib/sites.functions";

export const DEFAULT_SITE_ID = "cafe1000-0000-4000-8000-000000000001";
const STORAGE_KEY = "cafe1-selected-site";

export function useSites() {
  const load = useServerFn(listSites);
  const [sites, setSites] = useState<CafeSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteId, setSiteIdState] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_SITE_ID;
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SITE_ID;
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await load();
      setSites(rows);
      setSiteIdState((current) =>
        rows.some((site) => site.id === current) ? current : (rows[0]?.id ?? DEFAULT_SITE_ID),
      );
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Cafe 1 sites");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function setSiteId(next: string) {
    setSiteIdState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return {
    sites,
    siteId,
    site: sites.find((site) => site.id === siteId) ?? null,
    setSiteId,
    loading,
    error,
    refresh,
  };
}
