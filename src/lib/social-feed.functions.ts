import { createServerFn } from "@tanstack/react-start";

export const getAutomaticSocialFeed = createServerFn({ method: "GET" }).handler(async () => {
  const { loadAutomaticSocialFeed } = await import("./social-feed.server");
  return loadAutomaticSocialFeed();
});
