import {
  createSocialPost,
  mergeSocialPosts,
  type AutomaticSocialFeed,
  type AutomaticSocialProviderFeed,
  type SocialPost,
} from "./social-media";

type YouTubeChannelResponse = {
  items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
};

type YouTubePlaylistResponse = {
  items?: Array<{
    snippet?: { title?: string; resourceId?: { videoId?: string } };
    status?: { privacyStatus?: string };
  }>;
};

type InstagramMediaResponse = {
  data?: Array<{
    caption?: string;
    media_type?: string;
    media_product_type?: string;
    permalink?: string;
  }>;
};

type SocialEnvironment = Record<string, string | undefined>;

const SUCCESS_CACHE_MS = 15 * 60 * 1000;
const RETRY_CACHE_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_PROVIDER_POSTS = 6;
const MAX_XML_BYTES = 256_000;

let feedCache: { expires: number; value: AutomaticSocialFeed } | undefined;

function value(env: SocialEnvironment, name: string): string {
  return String(env[name] ?? "").trim();
}

function provider(
  providerName: AutomaticSocialProviderFeed["provider"],
  configured: boolean,
  posts: SocialPost[],
): AutomaticSocialProviderFeed {
  return {
    provider: providerName,
    configured,
    available: posts.length > 0,
    posts,
  };
}

async function jsonRequest<T>(url: URL, fetchImpl: typeof fetch): Promise<T> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`provider returned ${response.status}`);
  return (await response.json()) as T;
}

async function textRequest(url: URL, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`provider returned ${response.status}`);
  const body = await response.text();
  if (body.length > MAX_XML_BYTES) throw new Error("provider response was too large");
  return body;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

export function normaliseYouTubePlaylist(payload: YouTubePlaylistResponse): SocialPost[] {
  return (payload.items ?? []).flatMap((item) => {
    if (item.status?.privacyStatus !== "public") return [];
    const videoId = item.snippet?.resourceId?.videoId?.trim();
    const title = item.snippet?.title?.trim();
    if (!videoId || !title || /^(?:private|deleted) video$/i.test(title)) return [];
    const post = createSocialPost(
      "youtube",
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      title,
    );
    return post ? [post] : [];
  });
}

/** Parses YouTube's public uploads Atom feed so a channel can auto-update without an API key. */
export function normaliseYouTubeAtom(xml: string): SocialPost[] {
  const posts: SocialPost[] = [];
  for (const entry of xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? []) {
    const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1]?.trim();
    const rawTitle = entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const title = decodeXmlText(rawTitle).slice(0, 100);
    if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId) || !title) continue;
    const post = createSocialPost("youtube", `https://www.youtube.com/watch?v=${videoId}`, title);
    if (post) posts.push(post);
    if (posts.length === MAX_PROVIDER_POSTS) break;
  }
  return posts;
}

export function normaliseInstagramMedia(payload: InstagramMediaResponse): SocialPost[] {
  return (payload.data ?? []).flatMap((item) => {
    const mediaType = item.media_type?.toUpperCase();
    const productType = item.media_product_type?.toUpperCase();
    if (mediaType !== "VIDEO" && productType !== "REELS") return [];
    const title = item.caption?.trim().split("\n")[0]?.slice(0, 100) || "Instagram Reel";
    const post = createSocialPost("instagram", item.permalink, title);
    return post ? [post] : [];
  });
}

async function loadYouTube(
  env: SocialEnvironment,
  fetchImpl: typeof fetch,
): Promise<AutomaticSocialProviderFeed> {
  const apiKey = value(env, "YOUTUBE_API_KEY");
  const channelId = value(env, "YOUTUBE_CHANNEL_ID");
  const configuredSources = [
    ["playlist", value(env, "YOUTUBE_UPLOADS_PLAYLIST_ID")],
    ["channel", channelId],
    ["handle", value(env, "YOUTUBE_CHANNEL_HANDLE")],
  ].filter((entry) => entry[1]);
  const usePublicFeed =
    !apiKey &&
    configuredSources.length === 1 &&
    configuredSources[0]?.[0] === "channel" &&
    /^UC[A-Za-z0-9_-]{20,30}$/.test(channelId);
  const configured = usePublicFeed || Boolean(apiKey && configuredSources.length === 1);
  if (!configured) return provider("youtube", false, []);

  try {
    if (usePublicFeed) {
      const feedUrl = new URL("https://www.youtube.com/feeds/videos.xml");
      feedUrl.searchParams.set("channel_id", channelId);
      const posts = normaliseYouTubeAtom(await textRequest(feedUrl, fetchImpl));
      return provider("youtube", true, posts);
    }

    let playlistId = configuredSources[0]?.[1] ?? "";
    if (configuredSources[0]?.[0] !== "playlist") {
      const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      channelUrl.searchParams.set("part", "contentDetails");
      channelUrl.searchParams.set(
        configuredSources[0]?.[0] === "channel" ? "id" : "forHandle",
        configuredSources[0]?.[1] ?? "",
      );
      channelUrl.searchParams.set("key", apiKey);
      const channel = await jsonRequest<YouTubeChannelResponse>(channelUrl, fetchImpl);
      playlistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads?.trim() ?? "";
    }
    if (!playlistId) throw new Error("uploads playlist was not found");

    const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    playlistUrl.searchParams.set("part", "snippet,status");
    playlistUrl.searchParams.set("playlistId", playlistId);
    playlistUrl.searchParams.set("maxResults", String(MAX_PROVIDER_POSTS));
    playlistUrl.searchParams.set("key", apiKey);
    const playlist = await jsonRequest<YouTubePlaylistResponse>(playlistUrl, fetchImpl);
    return provider(
      "youtube",
      true,
      normaliseYouTubePlaylist(playlist).slice(0, MAX_PROVIDER_POSTS),
    );
  } catch (error) {
    console.error(
      "[social-feed] YouTube feed unavailable",
      error instanceof Error ? error.message : "provider error",
    );
    return provider("youtube", true, []);
  }
}

async function loadInstagram(
  env: SocialEnvironment,
  fetchImpl: typeof fetch,
): Promise<AutomaticSocialProviderFeed> {
  const accessToken = value(env, "INSTAGRAM_ACCESS_TOKEN");
  const version = value(env, "INSTAGRAM_GRAPH_VERSION") || "v23.0";
  const configured = Boolean(accessToken);
  if (!configured) return provider("instagram", false, []);

  try {
    const mediaUrl = new URL(`https://graph.instagram.com/${version}/me/media`);
    mediaUrl.searchParams.set(
      "fields",
      "id,caption,media_type,media_product_type,permalink,timestamp",
    );
    mediaUrl.searchParams.set("limit", String(MAX_PROVIDER_POSTS));
    mediaUrl.searchParams.set("access_token", accessToken);
    const media = await jsonRequest<InstagramMediaResponse>(mediaUrl, fetchImpl);
    return provider("instagram", true, normaliseInstagramMedia(media).slice(0, MAX_PROVIDER_POSTS));
  } catch (error) {
    console.error(
      "[social-feed] Instagram feed unavailable",
      error instanceof Error ? error.message : "provider error",
    );
    return provider("instagram", true, []);
  }
}

export async function loadAutomaticSocialFeed(
  fetchImpl: typeof fetch = fetch,
  env: SocialEnvironment = process.env,
): Promise<AutomaticSocialFeed> {
  if (feedCache && feedCache.expires > Date.now()) return feedCache.value;

  const providers = await Promise.all([loadYouTube(env, fetchImpl), loadInstagram(env, fetchImpl)]);
  const posts = mergeSocialPosts(...providers.map((item) => item.posts));
  const result = { providers, posts };
  feedCache = {
    expires: Date.now() + (posts.length > 0 ? SUCCESS_CACHE_MS : RETRY_CACHE_MS),
    value: result,
  };
  return result;
}

export function resetAutomaticSocialFeedCacheForTests(): void {
  feedCache = undefined;
}
