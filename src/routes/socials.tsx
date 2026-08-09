import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ExternalLink,
  Facebook,
  Instagram,
  MessageCircleHeart,
  Music2,
  Play,
  Star,
  Youtube,
} from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { FacebookPageFeed } from "@/components/facebook-page-feed";
import { SocialFeedCarousel } from "@/components/social-feed-carousel";
import { TikTokCreatorFeed } from "@/components/tiktok-creator-feed";
import { getGoogleReviews } from "@/lib/google-reviews.functions";
import { getAutomaticSocialFeed } from "@/lib/social-feed.functions";
import {
  findSocialProfile,
  GOOGLE_REVIEWS_URL,
  mergeSocialPosts,
  SOCIAL_POSTS,
  SOCIAL_PROFILES,
  type SocialPlatform,
} from "@/lib/social-media";
import { breadcrumbJsonLd, canonicalLink, jsonLdScript, seoMeta, webPageJsonLd } from "@/lib/seo";

const title = "Café 1 St Albans Videos, Social Posts & Google Reviews";
const description =
  "Watch Café 1 St Albans food videos and updates from our official Facebook, Instagram, TikTok and YouTube sources, plus attributed Google reviews.";

export const Route = createFileRoute("/socials")({
  head: () => ({
    meta: seoMeta({ title, description, path: "/socials" }),
    links: [canonicalLink("/socials")],
    scripts: [
      jsonLdScript(webPageJsonLd({ name: title, description, path: "/socials" })),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Socials and reviews", path: "/socials" },
        ]),
      ),
    ],
  }),
  component: Socials,
});

const ICONS: Record<SocialPlatform, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
};

function Socials() {
  const { data: automatic, isLoading: isSocialLoading } = useQuery({
    queryKey: ["public-automatic-social-feed"],
    queryFn: () => getAutomaticSocialFeed({ data: undefined as never }),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  const { data: google, isLoading } = useQuery({
    queryKey: ["public-google-reviews"],
    queryFn: () => getGoogleReviews({ data: undefined as never }),
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  const posts = mergeSocialPosts(automatic?.posts ?? [], SOCIAL_POSTS);
  const facebook = findSocialProfile(SOCIAL_PROFILES, "facebook");
  const tiktok = findSocialProfile(SOCIAL_PROFILES, "tiktok");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border bg-secondary/55">
          <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_0.72fr] lg:items-center lg:py-24">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                Watch · follow · review
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[0.98] sm:text-6xl">
                Fresh from Café 1.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Food clips, behind-the-counter moments, weekly specials and customer
                favourites—played here from our official social channels.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                {SOCIAL_PROFILES.map((profile) => {
                  const Icon = ICONS[profile.platform];
                  return (
                    <a
                      key={profile.platform}
                      href={profile.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                    >
                      <Icon className="h-4 w-4" /> {profile.label}
                      <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                    </a>
                  );
                })}
              </div>
            </div>
            <div className="card-3d relative overflow-hidden rounded-[2rem] border border-border bg-card p-7 sm:p-9">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10" />
              <span className="icon-3d h-14 w-14">
                <Play className="h-6 w-6" />
              </span>
              <p className="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                From the source
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold">
                One place for every Café 1 channel.
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                New YouTube videos and Instagram Reels can appear automatically. Every player links
                to its original source, and no social tracking loads unless you allow it.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="latest-socials">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Latest clips
              </p>
              <h2 id="latest-socials" className="mt-2 font-display text-4xl font-bold">
                See what is cooking
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Social players respect your cookie choice. You can always open the original post
              without enabling an embedded player.
            </p>
          </div>

          {isSocialLoading ? (
            <div
              className="mt-9 flex gap-6 overflow-hidden"
              aria-label="Loading the latest social posts"
            >
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-96 w-[88vw] max-w-[31rem] shrink-0 animate-pulse rounded-3xl bg-muted sm:w-[30rem]"
                />
              ))}
            </div>
          ) : posts.length ? (
            <SocialFeedCarousel posts={posts} />
          ) : (
            <div className="mt-9 rounded-3xl border border-dashed border-primary/30 bg-primary-soft p-8 text-center sm:p-12">
              <span className="icon-3d mx-auto h-14 w-14">
                <Play className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-bold">Connect the automatic feeds</h3>
              <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                Our official profiles are ready. The latest videos will appear here after the
                YouTube or Instagram server connection is enabled.
              </p>
              {SOCIAL_PROFILES[0] && (
                <a
                  href={SOCIAL_PROFILES[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Follow {SOCIAL_PROFILES[0].label} <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </section>

        {(facebook || tiktok) && (
          <section
            className="border-y border-border bg-secondary/45"
            aria-labelledby="live-socials"
          >
            <div className="mx-auto max-w-6xl px-4 py-16">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Always current
                </p>
                <h2 id="live-socials" className="mt-2 font-display text-4xl font-bold">
                  Follow the café as it happens
                </h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  Browse our official TikTok creator feed and Facebook timeline here. These players
                  load only after you allow marketing cookies.
                </p>
              </div>
              <div className="mt-9 grid gap-6 lg:grid-cols-2">
                {tiktok && <TikTokCreatorFeed profileUrl={tiktok.url} />}
                {facebook && <FacebookPageFeed profileUrl={facebook.url} />}
              </div>
            </div>
          </section>
        )}

        <section className="border-b border-border" aria-labelledby="google-reviews">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Customer feedback
                </p>
                <h2 id="google-reviews" className="mt-2 font-display text-4xl font-bold">
                  Live Google reviews
                </h2>
                {google?.available && google.rating !== null && (
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-bold text-foreground">
                      {google.rating.toFixed(1)}{" "}
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </span>
                    {google.reviewCount !== null && (
                      <span>from {google.reviewCount.toLocaleString("en-GB")} Google reviews</span>
                    )}
                  </p>
                )}
              </div>
              <a
                href={google?.googleMapsUrl ?? GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:border-primary hover:text-primary"
              >
                Read or leave a Google review <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {isLoading ? (
              <div className="mt-8 grid gap-5 md:grid-cols-3" aria-label="Loading Google reviews">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-56 animate-pulse rounded-3xl bg-muted" />
                ))}
              </div>
            ) : google?.available && google.reviews.length ? (
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                {google.reviews.map((review, index) => (
                  <article
                    key={`${review.author}-${index}`}
                    className="card-3d rounded-3xl border border-border bg-card p-6"
                  >
                    <div className="flex gap-1" aria-label={`${review.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }, (_, star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${star < review.rating ? "fill-amber-400 text-amber-400" : "text-border"}`}
                        />
                      ))}
                    </div>
                    <blockquote className="mt-4 line-clamp-6 text-sm leading-relaxed text-muted-foreground">
                      “{review.text}”
                    </blockquote>
                    <div className="mt-5 border-t border-border pt-4">
                      {review.authorUrl ? (
                        <a
                          href={review.authorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold hover:text-primary"
                        >
                          {review.author}
                        </a>
                      ) : (
                        <p className="font-semibold">{review.author}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">{review.published}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-border bg-card p-8 text-center">
                <MessageCircleHeart className="mx-auto h-9 w-9 text-primary" />
                <h3 className="mt-4 font-display text-2xl font-bold">
                  Your feedback helps a local café
                </h3>
                <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
                  Open our Google listing to read the latest feedback or tell us about your visit.
                </p>
              </div>
            )}
            <p className="mt-6 text-center text-xs font-medium text-muted-foreground">
              Powered by Google · Reviews remain attributed to their original authors.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
