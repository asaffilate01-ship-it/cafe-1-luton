import { useEffect, useState } from "react";
import { MonitorDown } from "lucide-react";
import { toast } from "sonner";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Installs the current screen as its own desktop/home-screen app.
 *
 * Swapping the <link rel="manifest"> while this screen is mounted is what makes
 * Windows, macOS, Android and iOS treat it as a separate app (own icon, own
 * window, own start URL) instead of another window of the main site.
 */
export function InstallAppButton({
  manifest,
  label = "Install app",
  className = "",
}: {
  manifest: string;
  label?: string;
  className?: string;
}) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previous = link?.getAttribute("href") ?? null;
    if (link) link.setAttribute("href", manifest);
    else {
      const added = document.createElement("link");
      added.rel = "manifest";
      added.href = manifest;
      document.head.appendChild(added);
    }
    return () => {
      if (link && previous) link.setAttribute("href", previous);
    };
  }, [manifest]);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setInstalled(Boolean(standalone));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    const ua = navigator.userAgent;
    const isApple = /iPhone|iPad|iPod|Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua);
    toast.info(
      isApple
        ? "Safari: tap Share → Add to Home Screen (iPhone/iPad) or File → Add to Dock (Mac) to install this screen as its own app."
        : "Open this page in Chrome or Edge and use the install icon in the address bar (⋮ → Install app) to add it as its own app.",
      { duration: 9000 },
    );
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      className={
        className ||
        "flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/20"
      }
      title="Install this kitchen display as a standalone app on Windows, macOS, Android or iOS"
    >
      <MonitorDown className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
