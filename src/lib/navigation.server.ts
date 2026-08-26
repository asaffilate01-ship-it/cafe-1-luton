import { getGoogleMapsApiKey } from "./google-maps-env.server";

/** Turn-by-turn routing via the Google Maps Routes API (server only). */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export type NavStep = {
  instruction: string;
  distance_m: number;
  end: { lat: number; lng: number } | null;
  maneuver: string | null;
};

export type NavRoute = {
  distance_m: number;
  duration_s: number;
  polyline: string | null;
  steps: NavStep[];
};

export async function computeWalkingOrDrivingRoute(input: {
  origin: { lat: number; lng: number };
  destination: string;
  mode: "DRIVE" | "TWO_WHEELER" | "WALK" | "BICYCLE";
}): Promise<NavRoute | null> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmKey = getGoogleMapsApiKey();
  if (!lovableKey || !gmKey) return null;

  const body = {
    origin: { location: { latLng: { latitude: input.origin.lat, longitude: input.origin.lng } } },
    destination: { address: `${input.destination}, UK` },
    travelMode: input.mode,
    ...(input.mode === "DRIVE" || input.mode === "TWO_WHEELER"
      ? { routingPreference: "TRAFFIC_AWARE" }
      : {}),
    languageCode: "en-GB",
    units: "IMPERIAL",
  };

  const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": gmKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.endLocation",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 403) {
    const details: Array<{ reason?: string }> =
      ((await res.json()) as { error?: { details?: Array<{ reason?: string }> } })?.error?.details ?? [];
    const reason = details.find((d) => d.reason)?.reason;
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED")
      throw new Error(
        'Google Maps server key is referrer-restricted. In Google Cloud Console, set the server key\'s application restrictions to "None" or "IP addresses".',
      );
    if (reason === "API_KEY_SERVICE_BLOCKED")
      throw new Error(
        "Google Maps server key does not allow the Routes API. Add it to the server key's allowed-APIs list in Google Cloud Console.",
      );
    throw new Error("Google Maps routing was denied (403). Check the server key's restrictions.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Routing failed [${res.status}]: ${text}`);
  }

  const json = (await res.json()) as {
    routes?: Array<{
      duration?: string;
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
      legs?: Array<{
        steps?: Array<{
          distanceMeters?: number;
          endLocation?: { latLng?: { latitude?: number; longitude?: number } };
          navigationInstruction?: { instructions?: string; maneuver?: string };
        }>;
      }>;
    }>;
  };

  const route = json.routes?.[0];
  if (!route) return null;

  const steps: NavStep[] = (route.legs ?? []).flatMap((leg) =>
    (leg.steps ?? []).map((s) => ({
      instruction: s.navigationInstruction?.instructions ?? "Continue",
      distance_m: s.distanceMeters ?? 0,
      maneuver: s.navigationInstruction?.maneuver ?? null,
      end:
        s.endLocation?.latLng?.latitude != null && s.endLocation?.latLng?.longitude != null
          ? { lat: s.endLocation.latLng.latitude, lng: s.endLocation.latLng.longitude }
          : null,
    })),
  );

  return {
    distance_m: route.distanceMeters ?? 0,
    duration_s: Number(String(route.duration ?? "0").replace("s", "")) || 0,
    polyline: route.polyline?.encodedPolyline ?? null,
    steps,
  };
}