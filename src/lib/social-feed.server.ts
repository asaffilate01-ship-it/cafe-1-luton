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
  const configuredSources = [
    ["playlist", value(env, "YOUTUBE_UPLOADS_PLAYLIST_ID")],
    ["channel", value(env, "YOUTUBE_CHANNEL_ID")],
    ["handle", value(env, "YOUTUBE_CHANNEL_HANDLE")],
  ].filter((entry) => entry[1]);
  const configured = Boolean(apiKey && configuredSources.length === 1);
  if (!configured) return provider("youtube", false, []);

  try {
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
