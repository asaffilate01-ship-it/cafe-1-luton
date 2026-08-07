import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "cafe1-till-favourites-v1";
const MAX_FAVOURITES = 24;

function load(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** Device-local quick keys so each counter can pin its own fastest sellers. */
export function useTillFavourites() {
  const [ids, setIds] = useState<string[]>(load);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_FAVOURITES)));
  }, [ids]);

  const toggle = useCallback((id: string) => {
    setIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [id, ...current].slice(0, MAX_FAVOURITES),
    );
  }, []);

  return { ids, toggle, has: (id: string) => ids.includes(id) };
}
