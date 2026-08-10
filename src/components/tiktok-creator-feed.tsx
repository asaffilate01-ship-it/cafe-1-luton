import { SocialConsentPlaceholder } from "@/components/social-consent-placeholder";
import { useConsent } from "@/lib/cookie-consent";
import { tiktokCreatorEmbedUrl } from "@/lib/social-media";

export function TikTokCreatorFeed({ profileUrl }: { profileUrl: string }) {
  const { hydrated, allows } = useConsent();
  const permitted = hydrated && allows("marketing");
  const embedUrl = tiktokCreatorEmbedUrl(profileUrl);

  if (!permitted || !embedUrl) {
    return <SocialConsentPlaceholder platform="TikTok" sourceUrl={profileUrl} />;
  }

  return (
    <div className="min-h-[38rem] overflow-hidden rounded-3xl border border-border bg-card">
      <iframe
        src={embedUrl}
        title="Latest videos from Café 1 on TikTok"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="encrypted-media; fullscreen"
        className="h-[42rem] w-full border-0"
      />
    </div>
  );
}
