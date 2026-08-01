import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeWalkingOrDrivingRoute } from "./navigation.server";

const schema = z.object({
  lat: z.number(),
  lng: z.number(),
  destination: z.string().min(3).max(300),
  mode: z.enum(["DRIVE", "TWO_WHEELER", "WALK", "BICYCLE"]).default("DRIVE"),
});

/** Turn-by-turn directions from the driver's current position to a drop-off. */
export const getDirections = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) =>
    computeWalkingOrDrivingRoute({
      origin: { lat: data.lat, lng: data.lng },
      destination: data.destination,
      mode: data.mode,
    }),
  );
