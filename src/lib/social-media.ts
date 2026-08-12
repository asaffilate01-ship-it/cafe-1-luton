export type SocialPlatform = "facebook" | "instagram" | "tiktok" | "youtube";

export type SocialPost = {
  platform: SocialPlatform;
  sourceUrl: string;
  embedUrl: string;
  title: string;
  aspect: "landscape" | "portrait";
};

export type SocialProfile = {
  platform: SocialPlatform;
  label: string;
  url: string;
};

export type AutomaticSocialProvider = "youtube" | "instagram";

export type AutomaticSocialProviderFeed = {
  provider: AutomaticSocialProvider;
  configured: boolean;
  available: boolean;
  posts: SocialPost[];
};

export type AutomaticSocialFeed = {
  providers: AutomaticSocialProviderFeed[];
  posts: SocialPost[];
};

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const ALLOWED_PROFILE_HOSTS: Record<SocialPlatform, Set<string>> = {
  facebook: new Set(["facebook.com", "www.facebook.com"]),
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  tiktok: new Set(["tiktok.com", "www.tiktok.com"]),
  youtube: new Set(["youtube.com", "www.youtube.com"]),
};

function httpsUrl(raw: unknown): URL | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function youtubeId(url: URL): string | null {
  if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const parts = url.pathname.split("/").filter(Boolean);
  if (["shorts", "embed", "live"].includes(parts[0] ?? "")) return parts[1] ?? null;
  return null;
}

function cleanVideoId(value: string | null): string | null {
  if (!value || !/^[A-Za-z0-9_-]{6,20}$/.test(value)) return null;
  return value;
}

export function createSocialPost(
  platform: SocialPlatform,
  rawUrl: unknown,
  rawTitle?: unknown,
): SocialPost | null {
  const url = httpsUrl(rawUrl);
  if (!url) return null;
  const sourceUrl = url.toString();
  const suppliedTitle = typeof rawTitle === "string" ? rawTitle.trim().slice(0, 100) : "";
  const title = suppliedTitle || `${PLATFORM_LABELS[platform]} video from Café 1`;

  if (platform === "youtube") {
    const id = cleanVideoId(youtubeId(url));
    if (!id) return null;
    return {
      platform,
      sourceUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
      title,
      aspect: "landscape",
    };
  }

  if (platform === "tiktok") {
    if (!["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(url.hostname)) return null;
    const id = url.pathname.match(/\/video\/(\d{8,30})/)?.[1];
    if (!id) return null;
    return {
      platform,
      sourceUrl,
      embedUrl: `https://www.tiktok.com/player/v1/${id}?autoplay=0&music_info=1&description=1`,
      title,
      aspect: "portrait",
    };
  }

  if (platform === "instagram") {
    if (!["instagram.com", "www.instagram.com"].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/(reel|p|tv)\/([A-Za-z0-9_-]{5,30})/);
    if (!match) return null;
    return {
      platform,
      sourceUrl,
      embedUrl: `https://www.instagram.com/${match[1]}/${match[2]}/embed/`,
      title,
      aspect: "portrait",
    };
  }

  if (!["facebook.com", "www.facebook.com"].includes(url.hostname)) return null;
  return {
    platform,
    sourceUrl,
    embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(sourceUrl)}&show_text=false&width=720`,
    title,
    aspect: "landscape",
  };
}

export function parseSocialPosts(raw: unknown): SocialPost[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let candidates: unknown;
  try {
    candidates = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(candidates)) return [];

  const posts: SocialPost[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates.slice(0, 12)) {
    if (!candidate || typeof candidate !== "object") continue;
    const item = candidate as { platform?: unknown; url?: unknown; title?: unknown };
    if (!Object.keys(PLATFORM_LABELS).includes(String(item.platform))) continue;
    const post = createSocialPost(item.platform as SocialPlatform, item.url, item.title);
    if (!post || seen.has(post.embedUrl)) continue;
    seen.add(post.embedUrl);
    posts.push(post);
    if (posts.length === 8) break;
  }
  return posts;
}

function profile(platform: SocialPlatform, raw: unknown, fallback = ""): SocialProfile | null {
  const url = httpsUrl(typeof raw === "string" && raw.trim() ? raw : fallback);
  if (!url || !ALLOWED_PROFILE_HOSTS[platform].has(url.hostname)) return null;
  return { platform, label: PLATFORM_LABELS[platform], url: url.toString() };
}

export function createSocialProfiles(env: Record<string, unknown>): SocialProfile[] {
  return [
    profile("facebook", env.VITE_SOCIAL_FACEBOOK_URL, "https://www.facebook.com/cafe1stalbans"),
    profile("instagram", env.VITE_SOCIAL_INSTAGRAM_URL, "https://www.instagram.com/cafe1stalbans/"),
    profile("tiktok", env.VITE_SOCIAL_TIKTOK_URL, "https://www.tiktok.com/@Cafe1_Stalbans"),
    profile("youtube", env.VITE_SOCIAL_YOUTUBE_URL),
  ].filter((item): item is SocialProfile => Boolean(item));
}

export function findSocialProfile(
  profiles: SocialProfile[],
  platform: SocialPlatform,
): SocialProfile | null {
  return profiles.find((profile) => profile.platform === platform) ?? null;
}

export function tiktokCreatorHandle(profileUrl: string): string | null {
  const url = httpsUrl(profileUrl);
  if (!url || !ALLOWED_PROFILE_HOSTS.tiktok.has(url.hostname)) return null;
  const handle = url.pathname.split("/").filter(Boolean)[0];
  if (!handle?.startsWith("@") || !/^@[A-Za-z0-9._]{2,30}$/.test(handle)) return null;
  // TikTok profile navigation is case-insensitive, and its creator embed only resolves the
  // canonical lower-case unique id, so normalise before handing the handle to the player.
  return handle.slice(1).toLowerCase();
}

export function facebookPagePluginUrl(profileUrl: string): string | null {
  const url = httpsUrl(profileUrl);
  if (!url || !ALLOWED_PROFILE_HOSTS.facebook.has(url.hostname)) return null;
  const plugin = new URL("https://www.facebook.com/plugins/page.php");
  plugin.searchParams.set("href", url.toString());
  plugin.searchParams.set("tabs", "timeline");
  plugin.searchParams.set("width", "500");
  plugin.searchParams.set("height", "620");
  plugin.searchParams.set("small_header", "true");
  plugin.searchParams.set("adapt_container_width", "true");
  plugin.searchParams.set("hide_cover", "false");
  plugin.searchParams.set("show_facepile", "false");
  return plugin.toString();
}

export function mergeSocialPosts(...groups: SocialPost[][]): SocialPost[] {
  const merged: SocialPost[] = [];
  const seen = new Set<string>();
  for (const post of groups.flat()) {
    if (seen.has(post.embedUrl)) continue;
    seen.add(post.embedUrl);
    merged.push(post);
    if (merged.length === 12) break;
  }
  return merged;
}

export const SOCIAL_POSTS = parseSocialPosts(import.meta.env.VITE_SOCIAL_EMBEDS_JSON);
export const SOCIAL_PROFILES = createSocialProfiles(import.meta.env);

export const GOOGLE_REVIEWS_URL =
  "https://www.google.com/search?q=Cafe+1+St+Albans+Crown+Court+AL1+3JU";
