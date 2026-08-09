import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import { SocialMediaEmbed } from "@/components/social-media-embed";
import type { SocialPost } from "@/lib/social-media";

export function SocialFeedCarousel({ posts }: { posts: SocialPost[] }) {
  const rail = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    rail.current?.scrollBy({
      left: direction * Math.min(520, rail.current.clientWidth),
      behavior: "smooth",
    });
  }

  return (
    <div className="mt-9">
      <div className="mb-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Show previous social posts"
          className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card hover:border-primary hover:text-primary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Show more social posts"
          className="grid h-11 w-11 place-items-center rounded-full border border-border bg-card hover:border-primary hover:text-primary"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div
        ref={rail}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:thin]"
        aria-label="Latest Café 1 social posts"
      >
        {posts.map((post) => (
          <div
            key={post.embedUrl}
            className="w-[88vw] max-w-[31rem] shrink-0 snap-start sm:w-[30rem]"
          >
            <SocialMediaEmbed post={post} />
          </div>
        ))}
      </div>
    </div>
  );
}
