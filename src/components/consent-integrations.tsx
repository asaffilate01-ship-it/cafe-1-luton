import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { ANALYTICS_SCRIPT_ID, parseGaMeasurementId } from "@/lib/analytics-consent";
import { useConsent } from "@/lib/cookie-consent";

type GtagArguments = [command: string, target: string, parameters?: Record<string, unknown>];
type AnalyticsWindow = Window & { dataLayer?: unknown[] };

function gtag(...args: GtagArguments) {
  const analyticsWindow = window as AnalyticsWindow;
  analyticsWindow.dataLayer ??= [];
  analyticsWindow.dataLayer.push(args);
}

function expireAnalyticsCookies() {
  for (const item of document.cookie.split(";")) {
    const name = item.split("=")[0]?.trim();
    if (!name?.startsWith("_ga")) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${window.location.hostname}; SameSite=Lax`;
  }
}

/** Loads analytics only after an explicit choice; advertising storage always remains denied. */
export function ConsentIntegrations() {
  const measurementId = parseGaMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID);
  const { hydrated, allows } = useConsent();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const configured = Boolean(measurementId);
  const permitted = configured && hydrated && allows("analytics");
  const configuredOnce = useRef(false);

  useEffect(() => {
    if (!configured) return;
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500,
    });
  }, [configured]);

  useEffect(() => {
    if (!measurementId || !hydrated) return;
    gtag("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: permitted ? "granted" : "denied",
    });

    if (!permitted) {
      document.getElementById(ANALYTICS_SCRIPT_ID)?.remove();
      configuredOnce.current = false;
      expireAnalyticsCookies();
      return;
    }

    if (!document.getElementById(ANALYTICS_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = ANALYTICS_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
    }
    if (!configuredOnce.current) {
      gtag("js", new Date().toISOString());
      gtag("config", measurementId, {
        anonymize_ip: true,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        send_page_view: false,
      });
      configuredOnce.current = true;
    }
  }, [hydrated, measurementId, permitted]);

  useEffect(() => {
    if (!measurementId || !permitted) return;
    gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: `${pathname}${search}`,
      page_title: document.title,
      send_to: measurementId,
    });
  }, [measurementId, pathname, permitted, search]);

  return null;
}
