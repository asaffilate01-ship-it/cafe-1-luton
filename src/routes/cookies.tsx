import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal-layout";
import { openCookieSettings, useConsent } from "@/lib/cookie-consent";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Café 1 St Albans" },
      {
        name: "description",
        content:
          "Which cookies Café 1 uses for ordering, analytics and marketing, and how to change your cookie preferences.",
      },
      { property: "og:title", content: "Cookie Policy — Café 1" },
      {
        property: "og:description",
        content: "Which cookies Café 1 uses and how to change your preferences.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://cafe1stalbans.co.uk/cookies" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://cafe1stalbans.co.uk/cookies" }],
  }),
  component: CookiePolicy,
});

function CookiePolicy() {
  const { consent, hydrated } = useConsent();
  return (
    <LegalPage
      title="Cookie Policy"
      intro="Cookies and similar browser storage keep the ordering site working and, with your permission, help us improve it."
    >
      <Section heading="Strictly necessary (always on)">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Basket</b> — remembers the items and add-ons you've chosen.
          </li>
          <li>
            <b>Sign-in session</b> — keeps you logged in to your customer, staff or driver account.
          </li>
          <li>
            <b>House account tab</b> — remembers the account you're ordering on.
          </li>
          <li>
            <b>Checkout &amp; payment</b> — links your order to the SumUp payment.
          </li>
          <li>
            <b>Cookie choice</b> — stores the preferences you set here.
          </li>
        </ul>
        <p>These cannot be switched off because the site cannot take orders without them.</p>
      </Section>
      <Section heading="Strictly necessary storage inventory">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2">Name or provider</th>
                <th className="p-2">Purpose</th>
                <th className="p-2">Typical duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="p-2 font-semibold">__cf_bm (Cloudflare)</td>
                <td className="p-2">Bot detection and protection of this website.</td>
                <td className="p-2">30 minutes after inactivity</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">cafe1_cookie_consent</td>
                <td className="p-2">Remembers the cookie categories you accepted or rejected.</td>
                <td className="p-2">180 days</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">Basket and order setup</td>
                <td className="p-2">
                  Keeps your basket, fulfilment choice and delivery setup on this device.
                </td>
                <td className="p-2">Up to 2 hours after activity, or until cleared</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">Supabase sign-in storage</td>
                <td className="p-2">
                  Maintains an authenticated customer, staff or driver session.
                </td>
                <td className="p-2">Until sign-out or session expiry</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">sidebar_state</td>
                <td className="p-2">Remembers the operational dashboard sidebar layout.</td>
                <td className="p-2">7 days</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Cloudflare may set its security cookie before you make a choice because it is required to
          protect the site. It is not used for advertising or cross-site tracking.
        </p>
      </Section>
      <Section heading="Analytics (optional)">
        <p>
          If analytics is enabled by Café 1, Google Analytics 4 loads only after you allow it. It
          records page use in aggregate so we can improve the menu and ordering flow. Advertising
          storage, signals and personalisation remain disabled. No analytics script or analytics
          storage is loaded before consent, and withdrawing consent stops further collection.
        </p>
      </Section>
      <Section heading="Marketing (optional)">
        <p>
          Used only if you allow them: measuring promotions, showing offers that are relevant to
          you, and loading social video players from Facebook, Instagram, TikTok or YouTube. Those
          players stay blocked until you consent.
        </p>
      </Section>
      <Section heading="Third parties">
        <p>
          Cloudflare provides website security and hosting-edge protection. SumUp may set strictly
          necessary cookies on its payment pages when you pay by card. Our website fonts are hosted
          by Café 1 and do not require a Google Fonts request. Google Maps services check delivery
          locations and provide attributed public review data. Facebook, Instagram, TikTok and
          YouTube receive browser data only when you allow marketing cookies and load an embedded
          player. Google Analytics receives browser data only if it is configured and you allow
          analytics.
        </p>
      </Section>
      <Section heading="Your current choice">
        <p>
          {hydrated && consent
            ? `Analytics: ${consent.analytics ? "allowed" : "off"} · Marketing: ${consent.marketing ? "allowed" : "off"} (set ${new Date(consent.decidedAt).toLocaleDateString()}, expires ${new Date(consent.expiresAt).toLocaleDateString()}).`
            : "You haven't set a preference yet — only strictly necessary storage is in use."}
        </p>
        <button
          onClick={openCookieSettings}
          className="mt-3 h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
        >
          Change cookie preferences
        </button>
      </Section>
      <Section heading="Managing cookies in your browser">
        <p>
          You can also block or delete cookies in your browser settings. Blocking strictly necessary
          cookies will stop the basket and checkout from working.
        </p>
      </Section>
      <Section heading="Policy details">
        <p>Last updated: 9 August 2026. Contact info@cafe1stalbans.co.uk with questions.</p>
      </Section>
    </LegalPage>
  );
}
