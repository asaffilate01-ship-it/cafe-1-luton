/**
 * The homepage banner set was reset on 26 August 2026. Promotions created
 * before this boundary are legacy records: they remain visible in Admin until
 * deliberately deleted, but no longer appear to customers.
 */
export const HOME_BANNER_RESET_AT = "2026-08-26T00:00:00.000Z";

export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  badge: string | null;
  image_url: string | null;
  bg_color: string | null;
  cta_label: string | null;
  cta_url: string | null;
  created_at: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export const PREORDER_HOME_BANNER: HomeBanner = {
  id: "cafe1-preorder",
  title: "Pre-order for later",
  subtitle:
    "Choose Luton Crown Court or Futures House, then select dine-in or takeaway and a convenient Later time.",
  badge: "Order ahead",
  image_url: null,
  bg_color: "#7f1d1d",
  cta_label: "Start your pre-order",
  cta_url: "/menu",
  created_at: HOME_BANNER_RESET_AT,
  active: true,
  starts_at: null,
  ends_at: null,
};

export function isPreorderBanner(title: string): boolean {
  return /pre[\s-]?order|order\s+ahead/i.test(title.trim());
}

export function isLiveAdminBanner(banner: HomeBanner, now = new Date()): boolean {
  if (!banner.active || isPreorderBanner(banner.title)) return false;
  if (new Date(banner.created_at).getTime() < new Date(HOME_BANNER_RESET_AT).getTime())
    return false;
  if (banner.starts_at && new Date(banner.starts_at).getTime() > now.getTime()) return false;
  if (banner.ends_at && new Date(banner.ends_at).getTime() <= now.getTime()) return false;
  return true;
}
