import { useEffect } from "react";

import { SocialConsentPlaceholder } from "@/components/social-consent-placeholder";
import { useConsent } from "@/lib/cookie-consent";
import { tiktokCreatorHandle } from "@/lib/social-media";

const SCRIPT_ID = "cafe1-tiktok-embed-script";

export function TikTokCreatorFeed({ profileUrl }: { profileUrl: string }) {
  const { hydrated, allows } = useConsent();
  const permitted = hydrated && allows("marketing");
  const handle = tiktokCreatorHandle(profileUrl);

  useEffect(() => {
    if (!permitted || !handle) return;
    document.getElementById(SCRIPT_ID)?.remove();
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
    return () => script.remove();
  }, [handle, permitted]);

  if (!permitted || !handle) {
    return <SocialConsentPlaceholder platform="TikTok" sourceUrl={profileUrl} />;
  }

  return (
    <div className="min-h-[38rem] overflow-hidden rounded-3xl border border-border bg-card p-4">
      <blockquote
        className="tiktok-embed"
        cite={profileUrl}
        data-unique-id={handle}
        data-embed-type="creator"
        style={{ maxWidth: "780px", minWidth: "288px", margin: "0 auto" }}
      >
        <section>
          <a href={profileUrl} target="_blank" rel="noopener noreferrer">
            @{handle} on TikTok
          </a>
        </section>
      </blockquote>
    </div>
  );
}
