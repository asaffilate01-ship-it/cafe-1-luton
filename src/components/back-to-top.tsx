import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Floating "back to top" button with a circular reading-progress ring.
 * Appears after the user scrolls past ~400px.
 */
export function BackToTop() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const y = window.scrollY || doc.scrollTop;
      setProgress(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0);
      setVisible(y > 400);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [path]);

  const hidden = /^\/(admin|kds|driver|pos|dev-login)/.test(path);
  if (hidden) return null;

  const r = 21;
  const circ = 2 * Math.PI * r;

  return (
    <button
      type="button"
      aria-label={`Back to top (${Math.round(progress * 100)}% of page scrolled)`}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-4 z-40 grid h-12 w-12 place-items-center rounded-full border border-border bg-background/90 text-foreground shadow-lg backdrop-blur transition-all duration-300 hover:bg-accent ${
        visible ? "pointer-events-auto opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-3"
      }`}
      style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
    >
      <svg className="absolute inset-0 h-12 w-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted opacity-40" />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="text-primary"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
        />
      </svg>
      <ArrowUp className="relative h-5 w-5" />
    </button>
  );
}