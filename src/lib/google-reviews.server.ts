import { getGoogleMapsApiKey } from "./google-maps-env.server";

export type PublicGoogleReview = {
  author: string;
  authorUrl: string | null;
  rating: number;
  text: string;
  published: string;
};

export type GoogleReviewsResult = {
  configured: boolean;
  available: boolean;
  rating: number | null;
  reviewCount: number | null;
  googleMapsUrl: string;
  reviews: PublicGoogleReview[];
};

type PlacesResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: Array<{
    rating?: number;
    relativePublishTimeDescription?: string;
    publishTime?: string;
    text?: { text?: string };
    authorAttribution?: { displayName?: string; uri?: string };
  }>;
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const DIRECT_PLACES_URL = "https://places.googleapis.com/v1/places";
const FALLBACK_URL = "https://www.google.com/search?q=Cafe+1+Luton+Crown+Court+LU1+2AA";
const CACHE_MS = 15 * 60 * 1000;
const FIELD_MASK =
  "rating,userRatingCount,googleMapsUri,reviews.rating,reviews.text,reviews.publishTime,reviews.relativePublishTimeDescription,reviews.authorAttribution";

let cache: { expires: number; value: GoogleReviewsResult } | undefined;

function safeGoogleUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !/(^|\.)google\.(?:com|co\.uk)$/.test(url.hostname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function numberInRange(value: unknown, min: number, max: number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function normalisePlacesResponse(
  payload: PlacesResponse,
): Omit<GoogleReviewsResult, "configured" | "available"> {
  const reviews = (payload.reviews ?? []).slice(0, 5).flatMap((review) => {
    const author = review.authorAttribution?.displayName?.trim().slice(0, 100);
    const text = review.text?.text?.trim().slice(0, 800);
    const rating = numberInRange(review.rating, 1, 5);
    if (!author || !text || rating === null) return [];
    return [
      {
        author,
        authorUrl: safeGoogleUrl(review.authorAttribution?.uri),
        rating,
        text,
        published:
          review.relativePublishTimeDescription?.trim().slice(0, 80) ||
          review.publishTime?.slice(0, 10) ||
          "Recent review",
      },
    ];
  });

  return {
    rating: numberInRange(payload.rating, 0, 5),
    reviewCount: numberInRange(payload.userRatingCount, 0, 10_000_000),
    googleMapsUrl: safeGoogleUrl(payload.googleMapsUri) ?? FALLBACK_URL,
    reviews,
  };
}

export async function loadGoogleReviews(
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleReviewsResult> {
  if (cache && cache.expires > Date.now()) return cache.value;

  const placeId = process.env.GOOGLE_PLACE_ID?.trim();
  const lovableKey = process.env.LOVABLE_API_KEY?.trim();
  const mapsKey = getGoogleMapsApiKey();
  if (!placeId || !mapsKey || !/^[A-Za-z0-9_-]{10,255}$/.test(placeId)) {
    return {
      configured: false,
      available: false,
      rating: null,
      reviewCount: null,
      googleMapsUrl: FALLBACK_URL,
      reviews: [],
    };
  }

  try {
    let response: Response | undefined;
    if (lovableKey) {
      response = await fetchImpl(`${GATEWAY_URL}/v1/places/${encodeURIComponent(placeId)}`, {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": mapsKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        signal: AbortSignal.timeout(8_000),
      }).catch(() => undefined);
    }
    if (!response?.ok) {
      response = await fetchImpl(`${DIRECT_PLACES_URL}/${encodeURIComponent(placeId)}`, {
        headers: {
          "X-Goog-Api-Key": mapsKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        signal: AbortSignal.timeout(8_000),
      });
    }
    if (!response.ok) throw new Error(`Google Places returned ${response.status}`);
    const details = normalisePlacesResponse((await response.json()) as PlacesResponse);
    const value = { configured: true, available: true, ...details };
    cache = { expires: Date.now() + CACHE_MS, value };
    return value;
  } catch (error) {
    console.error("[google-reviews] live reviews unavailable", error);
    return {
      configured: true,
      available: false,
      rating: null,
      reviewCount: null,
      googleMapsUrl: FALLBACK_URL,
      reviews: [],
    };
  }
}

export function resetGoogleReviewsCacheForTests(): void {
  cache = undefined;
}
