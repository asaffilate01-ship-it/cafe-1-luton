import { ExternalLink, LockKeyhole } from "lucide-react";

import { openCookieSettings } from "@/lib/cookie-consent";

export function SocialConsentPlaceholder({
  platform,
  sourceUrl,
}: {
  platform: string;
  sourceUrl: string;
}) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-3xl border border-dashed border-primary/30 bg-primary-soft p-7 text-center">
      <span className="icon-3d-soft h-12 w-12">
        <LockKeyhole className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-xl font-bold">{platform} is paused</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        This live feed comes directly from {platform} and may set cookies. Allow marketing cookies
        to see it here, or open the official Café 1 profile.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={openCookieSettings}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Cookie settings
        </button>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
        >
          Open profile <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}
