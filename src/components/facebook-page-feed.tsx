import { SocialConsentPlaceholder } from "@/components/social-consent-placeholder";
import { useConsent } from "@/lib/cookie-consent";
import { facebookPagePluginUrl } from "@/lib/social-media";

export function FacebookPageFeed({ profileUrl }: { profileUrl: string }) {
  const { hydrated, allows } = useConsent();
  const permitted = hydrated && allows("marketing");
  const embedUrl = facebookPagePluginUrl(profileUrl);

  if (!permitted || !embedUrl) {
    return <SocialConsentPlaceholder platform="Facebook" sourceUrl={profileUrl} />;
  }

  return (
    <div className="min-h-[38rem] overflow-hidden rounded-3xl border border-border bg-card p-2">
      <iframe
        src={embedUrl}
        title="Latest posts from Café 1 on Facebook"
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-[38rem] w-full border-0"
      />
    </div>
  );
}
