import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shares the driver's live GPS position for every active job.
 * Positions are written to `driver_locations` (one row per order) and stream
 * to the customer's tracking page over realtime.
 */
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
        setError(err.message);
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
