import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal-layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Café 1 Luton" },
      {
        name: "description",
        content:
          "How Café 1 collects, uses and protects your personal data when you order online for takeaway or dine-in.",
      },
      { property: "og:title", content: "Privacy Policy — Café 1" },
      {
        property: "og:description",
        content: "How Café 1 collects, uses and protects your personal data.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://cafe1luton.co.uk/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://cafe1luton.co.uk/privacy" }],
  }),
  component: () => (
    <LegalPage
      title="Privacy Policy"
      intro="This page explains what personal information Café 1 collects when you use our ordering site, why we collect it, and the choices you have."
    >
      <Section heading="Who we are">
        <p>
          Café 1 Luton, operating at Luton Crown Court, LU1 2AA and Futures House, Marsh Farm, LU3
          3QB, is the data controller for personal data collected through this site. Contact us at
          info@cafe1luton.co.uk.
        </p>
      </Section>
      <Section heading="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Order details: items, modifiers, notes, order type and time slot.</li>
          <li>Contact details: name, phone number, email address.</li>
          <li>Visit details: your chosen branch, order type, table number and order notes.</li>
          <li>Account details if you register: name, email, loyalty points, order history.</li>
          <li>House account details where your employer holds a tab with us.</li>
          <li>
            Technical data: device and browser information, and cookies as described in our Cookie
            Policy.
          </li>
        </ul>
      </Section>
      <Section heading="Card payments">
        <p>
          Card payments are processed by SumUp. Café 1 never sees or stores your full card number,
          expiry date or security code — we only receive a payment reference and whether the payment
          succeeded.
        </p>
      </Section>
      <Section heading="Why we use your data">
        <p>
          To take and prepare your order, to arrange dine-in or takeaway, to handle refunds and
          complaints, to operate house accounts and loyalty, to keep records required by law, and —
          only with your permission — to send marketing.
        </p>
      </Section>
      <Section heading="Legal bases">
        <p>
          Performance of a contract (fulfilling your order), legitimate interests (running and
          securing the café and our site), legal obligation (tax and accounting records) and consent
          (marketing and non-essential cookies).
        </p>
      </Section>
      <Section heading="Who we share it with">
        <p>
          Our payment provider (SumUp), website security and edge provider (Cloudflare), hosting and
          database provider (Supabase/Lovable), and Google Maps services used to show our café
          locations. If you allow analytics, Google Analytics receives the normal browser and
          page-use data with advertising features disabled. If you allow marketing cookies and play
          an embedded social video, its source platform receives the normal browser request. We do
          not sell your data.
        </p>
      </Section>
      <Section heading="How long we keep it">
        <p>
          Order and transaction records are kept for six years for tax purposes. Account data is
          kept until you ask us to delete it. Marketing consent records are kept until you withdraw
          consent.
        </p>
      </Section>
      <Section heading="Security and international services">
        <p>
          We use access controls, encrypted HTTPS connections, audit records and role-based database
          rules to protect data. Some technology providers may process data outside the UK; where
          that happens, we rely on the provider's applicable contractual and legal transfer
          safeguards. No internet service can guarantee absolute security.
        </p>
      </Section>
      <Section heading="Your rights">
        <p>
          You can request access, correction, deletion, restriction or a copy of your data, and
          object to processing. See our GDPR page for how to make a request, or contact
          info@cafe1luton.co.uk. You can also complain to the Information Commissioner's Office
          (ico.org.uk).
        </p>
      </Section>
      <Section heading="Policy details">
        <p>Last updated: 9 August 2026.</p>
      </Section>
    </LegalPage>
  ),
});
