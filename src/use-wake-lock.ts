import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";

export function PromoBanner() {
  const { data } = useQuery({
    queryKey: ["broadcasts", "active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("broadcasts")
        .select("id, title, body, cta_url, cta_label")
        .eq("active", true)
        .order("published_at", { ascending: false })
        .limit(1);
      return (data ?? [])[0] ?? null;
    },
    staleTime: 60_000,
  });
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    setDismissed(typeof window !== "undefined" ? sessionStorage.getItem("promo-dismissed") : null);
  }, []);
  if (!data || dismissed === data.id) return null;
  return (
    <div className="border-b border-primary/30 bg-primary/10">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3 text-sm">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-semibold text-primary">{data.title}</p>
          <p className="text-muted-foreground">{data.body}</p>
          {data.cta_url && (
            <a href={data.cta_url} className="mt-1 inline-block font-semibold text-primary underline">
              {data.cta_label || "Learn more"}
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem("promo-dismissed", data.id);
            setDismissed(data.id);
          }}
          className="rounded-full p-1 text-muted-foreground hover:bg-primary/10"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}