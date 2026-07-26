import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal-layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Café 1 St Albans" },
      { name: "description", content: "How Café 1 collects, uses and protects your personal data when you order online for delivery, collection or dine-in." },
      { property: "og:title", content: "Privacy Policy — Café 1" },
      { property: "og:description", content: "How Café 1 collects, uses and protects your personal data." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/privacy" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: () => (
    <LegalPage
      title="Privacy Policy"
      intro="This page explains what personal information Café 1 collects when you use our ordering site, why we collect it, and the choices you have."
    >
      <Section heading="Who we are">
        <p>Café 1, St Albans Crown Court, AL1 3JW is the data controller for personal data collected through this site. Contact us at hello@cafe1.example.</p>
      </Section>
      <Section heading="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Order details: items, modifiers, notes, order type and time slot.</li>
          <li>Contact details: name, phone number, email address.</li>
          <li>Delivery details: address, postcode, company or office name, delivery notes.</li>
          <li>Account details if you register: name, email, loyalty points, order history.</li>
          <li>House account details where your employer holds a tab with us.</li>
          <li>Technical data: device and browser information, and cookies as described in our Cookie Policy.</li>
        </ul>
      </Section>
      <Section heading="Card payments">
        <p>Card payments are processed by SumUp. Café 1 never sees or stores your full card number, expiry date or security code — we only receive a payment reference and whether the payment succeeded.</p>
      </Section>
      <Section heading="Why we use your data">
        <p>To take and prepare your order, to deliver it, to handle refunds and complaints, to operate house accounts and loyalty, to keep records required by law, and — only with your permission — to send marketing.</p>
      </Section>
      <Section heading="Legal bases">
        <p>Performance of a contract (fulfilling your order), legitimate interests (running and securing the café and our site), legal obligation (tax and accounting records) and consent (marketing and non-essential cookies).</p>
      </Section>
      <Section heading="Who we share it with">
        <p>Our payment provider (SumUp), our hosting and database provider, our delivery drivers for delivery orders, and postcode lookup services used to check our delivery radius. We do not sell your data.</p>
      </Section>
      <Section heading="How long we keep it">
        <p>Order and transaction records are kept for six years for tax purposes. Account data is kept until you ask us to delete it. Marketing consent records are kept until you withdraw consent.</p>
      </Section>
      <Section heading="Your rights">
        <p>You can request access, correction, deletion, restriction or a copy of your data, and object to processing. See our GDPR page for how to make a request, or contact hello@cafe1.example. You can also complain to the Information Commissioner's Office (ico.org.uk).</p>
      </Section>
    </LegalPage>
  ),
});