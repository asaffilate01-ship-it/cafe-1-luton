import { Building2, Loader2 } from "lucide-react";
import type { CafeSite } from "@/lib/sites.functions";

export function SiteSwitcher({
  sites,
  siteId,
  onChange,
  compact = false,
  loading = false,
  error = null,
}: {
  sites: CafeSite[];
  siteId: string;
  onChange: (siteId: string) => void;
  compact?: boolean;
  loading?: boolean;
  error?: string | null;
}) {
  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (error) return <span className="text-xs text-destructive">{error}</span>;
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      {!compact && <span className="sr-only">Cafe site</span>}
      <select
        value={siteId}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 max-w-56 rounded-xl border border-border bg-background px-3 font-semibold"
        aria-label="Select Cafe 1 site"
      >
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  );
}
