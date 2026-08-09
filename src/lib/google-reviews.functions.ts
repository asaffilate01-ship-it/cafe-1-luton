import { createServerFn } from "@tanstack/react-start";

export const getGoogleReviews = createServerFn({ method: "GET" }).handler(async () => {
  const { loadGoogleReviews } = await import("./google-reviews.server");
  return loadGoogleReviews();
});
