import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal-layout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Café 1 Luton" },
      {
        name: "description",
        content:
          "The terms that apply when you order food and drink from Café 1 for dine-in or takeaway.",
      },
      { property: "og:title", content: "Terms & Conditions — Café 1" },
      {
        property: "og:description",
        content: "Ordering, payment, takeaway and cancellation terms for Café 1.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://cafe1luton.co.uk/terms" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://cafe1luton.co.uk/terms" }],
  }),
  component: () => (
    <LegalPage
      title="Terms & Conditions"
      intro="These terms apply to every order placed through the Café 1 website and app."
    >
      <Section heading="Ordering">
        <p>
          An order is accepted once we confirm it at your selected café. We may refuse or cancel an
          order if an item is unavailable or the order details are incorrect.
        </p>
      </Section>
      <Section heading="Locations and opening hours">
        <p>
          Luton Crown Court is open Monday to Friday from 9:00am to 5:00pm. Futures House is open
          Monday to Friday from 9:00am to 5:00pm and weekends from 10:00am to 6:00pm. Dine-in and
          takeaway are available; public delivery is not offered. Available pre-order slots are
          shown in the menu.
        </p>
      </Section>
      <Section heading="Prices and payment">
        <p>
          Cafe 1 is not currently VAT registered, so the displayed total does not include a VAT
          charge and receipts do not show input VAT. Card payments are taken securely through SumUp
          at the time of ordering. House account (tab) orders are invoiced to the account holder and
          must be settled within the agreed terms.
        </p>
      </Section>
      <Section heading="Allergens">
        <p>
          Our kitchen handles nuts, gluten, dairy, eggs, soya, sesame and other allergens, so we
          cannot guarantee any item is free from traces. Please tell us about allergies in the order
          notes or by phone before ordering.
        </p>
      </Section>
      <Section heading="Cancellations and refunds">
        <p>
          Freshly prepared food is exempt from the standard 14-day cancellation right. You can
          cancel an order before we begin preparing it. If something is wrong with your order,
          contact us the same day and we will replace it or refund it.
        </p>
      </Section>
      <Section heading="Accounts and conduct">
        <p>
          Keep your login details secure. We may suspend accounts used for fraudulent, abusive or
          repeated no-show orders.
        </p>
      </Section>
      <Section heading="Liability and law">
        <p>
          Nothing in these terms limits liability for death, personal injury caused by negligence,
          or fraud. These terms are governed by the laws of England and Wales.
        </p>
      </Section>
    </LegalPage>
  ),
});
