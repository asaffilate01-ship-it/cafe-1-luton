import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWebPush, type PushTopic } from "@/hooks/use-web-push";

/**
 * Turns real push notifications on for this device — they arrive even when the
 * app (or the phone's browser) is closed, as long as the app is installed or
 * the site has been added to the home screen on iOS.
 */
export function PushAlertsButton({
  topics,
  siteId,
  label = "Phone alerts",
  onLabel = "Alerts on",
  className,
}: {
  topics: PushTopic[];
  siteId?: string | null;
  label?: string;
  onLabel?: string;
  className?: string;
}) {
  const push = useWebPush({ topics, siteId });
  if (!push.supported) return null;

  const base =
    className ??
    "flex shrink-0 items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-2 text-xs font-bold text-primary-foreground active:scale-[0.97] disabled:opacity-50";

  return (
    <button
      type="button"
      disabled={push.busy}
      onClick={() => {
        void (async () => {
          if (push.enabled) {
            await push.disable();
            toast.success("Push alerts turned off on this device");
            return;
          }
          const res = await push.enable();
          if (res.ok) toast.success("Push alerts on for this device");
          else toast.error(res.reason ?? "Couldn't turn on alerts");
        })();
      }}
      className={base}
      title={
        push.enabled
          ? "Push alerts are on for this device — tap to turn them off"
          : "Get alerts on this device even when the app is closed"
      }
    >
      {push.busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : push.enabled ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
      <span>{push.enabled ? onLabel : label}</span>
    </button>
  );
}
