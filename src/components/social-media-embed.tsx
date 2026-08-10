import { ExternalLink, LockKeyhole } from "lucide-react";

import { allowSocialPlayers, openCookieSettings, useConsent } from "@/lib/cookie-consent";
import type { SocialPost } from "@/lib/social-media";

export function SocialMediaEmbed({ post }: { post: SocialPost }) {
  const { hydrated, allows } = useConsent();
  const permitted = hydrated && allows("marketing");
  const portrait = post.aspect === "portrait";

  return (
    <article className="card-3d overflow-hidden rounded-3xl border border-border bg-card">
      <div
        className={
          portrait
            ? "mx-auto aspect-[9/16] w-full max-w-[25rem] bg-secondary"
            : "aspect-video w-full bg-secondary"
        }
      >
        {permitted ? (
          <iframe
            src={post.embedUrl}
            title={post.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full min-h-64 flex-col items-center justify-center p-6 text-center">
            <span className="icon-3d-soft h-12 w-12">
              <LockKeyhole className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-display text-xl font-bold">Social video is paused</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              The player comes directly from {platformName(post.platform)} and may set cookies.
              Allow marketing cookies to play it here, or open the original post.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={allowSocialPlayers}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Allow and play
              </button>
              <button
                type="button"
                onClick={openCookieSettings}
                className="rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
              >
                Cookie settings
              </button>
              <a
                href={post.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
              >
                Open original <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {platformName(post.platform)}
          </p>
          <h2 className="mt-1 font-semibold leading-snug">{post.title}</h2>
        </div>
        <a
          href={post.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${post.title} on ${platformName(post.platform)}`}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border hover:border-primary hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}

function platformName(platform: SocialPost["platform"]) {
  return platform === "tiktok"
    ? "TikTok"
    : platform === "youtube"
      ? "YouTube"
      : platform === "instagram"
        ? "Instagram"
        : "Facebook";
}
