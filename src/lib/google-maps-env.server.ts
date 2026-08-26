/** Reads the linked Google Maps API key, preferring the newest connection. */
export function getGoogleMapsApiKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY_1?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();
}
