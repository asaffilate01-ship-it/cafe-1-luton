import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal-layout";
import { openCookieSettings, useConsent } from "@/lib/cookie-consent";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Café 1 St Albans" },
      { name: "description", content: "Which cookies Café 1 uses for ordering, analytics and marketing, and how to change your cookie preferences." },
      { property: "og:title", content: "Cookie Policy — Café 1" },
      { property: "og:description", content: "Which cookies Café 1 uses and how to change your preferences." },
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
          <li><b>Basket</b> — remembers the items and add-ons you've chosen.</li>
          <li><b>Sign-in session</b> — keeps you logged in to your customer, staff or driver account.</li>
          <li><b>House account tab</b> — remembers the account you're ordering on.</li>
          <li><b>Checkout &amp; payment</b> — links your order to the SumUp payment.</li>
          <li><b>Cookie choice</b> — stores the preferences you set here.</li>
        </ul>
        <p>These cannot be switched off because the site cannot take orders without them.</p>
      </Section>
      <Section heading="Analytics (optional)">
        <p>Used only if you allow them: aggregated statistics on which pages and menu items are viewed, so we can improve the menu and the ordering flow. No analytics storage is set until you consent.</p>
      </Section>
      <Section heading="Marketing (optional)">
        <p>Used only if you allow them: measuring promotions and showing offers that are relevant to you.</p>
      </Section>
      <Section heading="Third parties">
        <p>SumUp sets cookies on its own payment pages when you pay by card. Google Fonts is used to load our typefaces. Postcode lookups are made to postcodes.io when you enter a delivery postcode.</p>
      </Section>
      <Section heading="Your current choice">
        <p>
          {hydrated && consent
            ? `Analytics: ${consent.analytics ? "allowed" : "off"} · Marketing: ${consent.marketing ? "allowed" : "off"} (set ${new Date(consent.decidedAt).toLocaleDateString()}).`
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
        <p>You can also block or delete cookies in your browser settings. Blocking strictly necessary cookies will stop the basket and checkout from working.</p>
      </Section>
    </LegalPage>
  );
}