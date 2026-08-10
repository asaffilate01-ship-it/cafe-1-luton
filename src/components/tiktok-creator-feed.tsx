import { useEffect } from "react";

import { SocialConsentPlaceholder } from "@/components/social-consent-placeholder";
import { useConsent } from "@/lib/cookie-consent";
import { tiktokCreatorHandle } from "@/lib/social-media";

const TIKTOK_EMBED_SCRIPT_ID = "cafe1-tiktok-creator-embed";

export function TikTokCreatorFeed({ profileUrl }: { profileUrl: string }) {
  const { hydrated, allows } = useConsent();
  const permitted = hydrated && allows("marketing");
  const handle = tiktokCreatorHandle(profileUrl);

  useEffect(() => {
    if (!permitted || !handle) return;

    // TikTok creator profiles are rendered by its supported embed script, not a profile iframe.
    // Reinsert the script on SPA navigation so newly mounted creator markup is processed.
    document.getElementById(TIKTOK_EMBED_SCRIPT_ID)?.remove();
    const script = document.createElement("script");
    script.id = TIKTOK_EMBED_SCRIPT_ID;
    script.async = true;
    script.src = "https://www.tiktok.com/embed.js";
    document.body.appendChild(script);

    return () => script.remove();
  }, [handle, permitted]);

  if (!permitted || !handle) {
    return <SocialConsentPlaceholder platform="TikTok" sourceUrl={profileUrl} />;
  }

  return (
    <div className="min-h-[38rem] overflow-hidden rounded-3xl border border-border bg-card p-3 sm:p-5">
      <blockquote
        className="tiktok-embed mx-auto"
        cite={profileUrl}
        data-unique-id={handle}
        data-embed-type="creator"
        style={{ maxWidth: "780px", minWidth: "288px" }}
      >
        <section className="flex min-h-[34rem] flex-col items-center justify-center text-center">
          <p className="font-display text-xl font-bold">Café 1 on TikTok</p>
          <p className="mt-2 text-sm text-muted-foreground">Loading our latest TikTok videos…</p>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Open @{handle}
          </a>
        </section>
      </blockquote>
    </div>
  );
}
