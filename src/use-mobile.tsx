import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shares the driver's live GPS position for every active job.
 * Positions are written to `driver_locations` (one row per order) and stream
 * to the customer's tracking page over realtime.
 */
function friendlyGeoError(err: GeolocationPositionError): string {
  const inIframe = typeof window !== "undefined" && window.self !== window.top;
  const insecure =
    typeof window !== "undefined" &&
    window.location.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname);
  switch (err.code) {
    case err.PERMISSION_DENIED:
      if (inIframe)
        return "Location is blocked inside the editor preview. Open the driver app in its own browser tab (/driver) and allow location.";
      if (insecure) return "Location needs a secure (https) connection. Open the driver app over https.";
      return "Location permission was denied. Enable location for this site in your browser settings (tap the padlock / site settings → Location → Allow), then try again.";
    case err.POSITION_UNAVAILABLE:
      return "Couldn't get a GPS fix. Check that location services are on for your device.";
    case err.TIMEOUT:
      return "Timed out getting your location. Move to a spot with better signal and try again.";
    default:
      return err.message || "Could not access your location.";
  }
}

export function useDriverLocationSharing(driverId: string | undefined, orderIds: string[]) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ lat: number; lng: number; at: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const ordersRef = useRef<string[]>(orderIds);
  const sending = useRef(false);

  ordersRef.current = orderIds;

  const push = useCallback(
    async (pos: GeolocationPosition) => {
      if (!driverId || sending.current) return;
      const ids = ordersRef.current;
      if (!ids.length) return;
      sending.current = true;
      const row = {
        driver_id: driverId,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
        accuracy: pos.coords.accuracy ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error: err } = await supabase
        .from("driver_locations")
        .upsert(ids.map((order_id) => ({ order_id, ...row })), { onConflict: "order_id" });
      sending.current = false;
      if (err) setError(err.message);
      else {
        setError(null);
        setLast({ lat: row.lat, lng: row.lng, at: Date.now() });
      }
    },
    [driverId],
  );

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setSharing(false);
  }, []);

  const start = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location is not supported on this device");
      return;
    }
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => void push(pos),
      (err) => {
        setError(friendlyGeoError(err));
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    setSharing(true);
  }, [push, stop]);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  return { sharing, start, stop, error, last };
}
