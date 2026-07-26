import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getDirections } from "@/lib/navigation.functions";
import {
  Navigation2,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  RotateCcw,
  Flag,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

type Step = { instruction: string; distance_m: number; end: { lat: number; lng: number } | null; maneuver: string | null };
type Route = { distance_m: number; duration_s: number; polyline: string | null; steps: Step[] };

function metres(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1609.34).toFixed(1)} mi`;
}

function mins(s: number) {
  const m = Math.max(1, Math.round(s / 60));
  return `${m} min`;
}

function ManeuverIcon({ maneuver, className }: { maneuver: string | null; className?: string }) {
  const m = (maneuver ?? "").toUpperCase();
  if (m.includes("UTURN")) return <RotateCcw className={className} />;
  if (m.includes("LEFT")) return <CornerUpLeft className={className} />;
  if (m.includes("RIGHT")) return <CornerUpRight className={className} />;
  if (m.includes("DESTINATION")) return <Flag className={className} />;
  return <ArrowUp className={className} />;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * In-app turn-by-turn guidance for a delivery drop-off. Recalculates the route
 * from the driver's live position and advances the current step as they move.
 */
export function TurnByTurn({
  destination,
  position,
}: {
  destination: string;
  position: { lat: number; lng: number } | null;
}) {
  const directions = useServerFn(getDirections);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const lastFetch = useRef(0);

  const load = useCallback(async () => {
    if (!position) {
      setError("Turn on live location to get directions.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = (await directions({
        data: { lat: position.lat, lng: position.lng, destination, mode: "DRIVE" },
      })) as Route | null;
      if (!r) setError("Directions are unavailable right now.");
      setRoute(r);
      setStepIndex(0);
      lastFetch.current = Date.now();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get directions");
    } finally {
      setLoading(false);
    }
  }, [directions, destination, position]);

  // Advance the current step once the driver reaches its end point.
  useEffect(() => {
    if (!route || !position) return;
    const step = route.steps[stepIndex];
    if (!step?.end) return;
    if (distanceMeters(position, step.end) < 30 && stepIndex < route.steps.length - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [position, route, stepIndex]);

  // Light re-route: refresh at most every 60s while navigating.
  useEffect(() => {
    if (!route || !position) return;
    const t = setInterval(() => {
      if (Date.now() - lastFetch.current > 60000) void load();
    }, 15000);
    return () => clearInterval(t);
  }, [route, position, load]);

  const current = route?.steps[stepIndex];
  const remaining = route?.steps.slice(stepIndex + 1) ?? [];
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`;

  return (
    <div className="mt-4 rounded-2xl border border-border bg-secondary/50 p-4">
      {!route ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            <Navigation2 className="h-4 w-4" />
            {loading ? "Getting route…" : "Turn-by-turn"}
          </button>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold"
          >
            <ExternalLink className="h-4 w-4" /> Google Maps
          </a>
        </div>
      ) : (
        <div>
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <ManeuverIcon maneuver={current?.maneuver ?? null} className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-snug">{current?.instruction}</p>
              <p className="text-sm text-muted-foreground">
                {metres(current?.distance_m ?? 0)} · {metres(route.distance_m)} total · ETA {mins(route.duration_s)}
              </p>
            </div>
          </div>

          {showAll && remaining.length > 0 && (
            <ol className="mt-3 space-y-2 border-t border-border pt-3">
              {remaining.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ManeuverIcon maneuver={s.maneuver} className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1">{s.instruction}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{metres(s.distance_m)}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {remaining.length > 0 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="h-9 rounded-full border border-border bg-card px-4 text-xs font-semibold"
              >
                {showAll ? "Hide steps" : `All steps (${remaining.length})`}
              </button>
            )}
            <button
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-4 text-xs font-semibold disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Re-route
            </button>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-4 text-xs font-semibold"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Google Maps
            </a>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}