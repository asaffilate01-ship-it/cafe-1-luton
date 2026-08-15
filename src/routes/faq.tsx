import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal-layout";
import { faqJsonLd, jsonLdScript } from "@/lib/seo";

const faqs = [
  {
    question: "Where is Café 1 and what are the opening hours?",
    answer:
      "Café 1 is inside St Albans Crown Court, AL1 3JU. We serve breakfast, lunch and hot drinks on court sitting days; live opening times are shown at the top of every page.",
  },
  {
    question: "Can I order online for collection or delivery?",
    answer:
      "Yes. Order from the menu for dine-in, collection or local delivery, and choose ASAP or a timed slot at checkout. Ordering direct means no aggregator mark-up.",
  },
  {
    question: "How do I pay?",
    answer:
      "Card online via SumUp, plus Google Pay and Apple Pay where supported, or card and cash at the counter. Approved court and chambers house accounts can charge to a weekly tab.",
  },
  {
    question: "I'm on jury service — how does the juror allowance work?",
    answer:
      "Verify your HMCTS Juror ID on the jury menu page. Your daily allowance is applied automatically and scheme members receive 10% off non-beverage items. We never store your personal details.",
  },
  {
    question: "Do you cater for halal, vegetarian and allergy needs?",
    answer:
      "We serve halal chicken and lamb, with vegetarian and vegan options daily. Please tell us about allergies in the order notes or at the counter and staff will confirm what is safe.",
  },
  {
    question: "How do I use a promo code?",
    answer:
      "Enter it in the promo code field on the place-order page. One promo applies per order and codes cannot be combined with juror or member discounts.",
  },
  {
    question: "Something went wrong with my order — what do I do?",
    answer:
      "Speak to the counter team, or email info@cafe1stalbans.co.uk with your order number. Our formal complaints process is published on the complaints page.",
  },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Ordering, Payments & Jury Service | Café 1 St Albans" },
      {
        name: "description",
        content:
          "Answers about Café 1 St Albans: opening hours, online ordering, delivery, SumUp payments, house accounts, juror allowances, halal and allergy information.",
      },
      { property: "og:title", content: "Café 1 St Albans — Frequently Asked Questions" },
      {
        property: "og:description",
        content:
          "Opening hours, ordering, delivery, payments, house accounts and the juror allowance scheme explained.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://cafe1stalbans.co.uk/faq" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://cafe1stalbans.co.uk/faq" }],
    scripts: [jsonLdScript(faqJsonLd(faqs))],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <LegalPage
      title="Frequently asked questions"
      intro="Everything customers, court staff and jurors ask us most often about ordering from Café 1."
    >
      {faqs.map((faq) => (
        <Section key={faq.question} heading={faq.question}>
          <p>{faq.answer}</p>
        </Section>
      ))}
      <Section heading="Still need help?">
        <p>
          Email info@cafe1stalbans.co.uk, or use our{" "}
          <Link to="/contact" className="text-primary underline underline-offset-2">
            contact page
          </Link>
          . For formal issues see{" "}
          <Link to="/complaints" className="text-primary underline underline-offset-2">
            complaints
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}