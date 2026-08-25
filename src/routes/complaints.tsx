import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal-layout";

export const Route = createFileRoute("/complaints")({
  head: () => ({
    meta: [
      { title: "Complaints Policy — Café 1 Luton" },
      {
        name: "description",
        content:
          "How to raise a complaint with Café 1 about an order or service, and how quickly we respond.",
      },
      { property: "og:title", content: "Complaints Policy — Café 1" },
      {
        property: "og:description",
        content: "How to raise a complaint with Café 1 and how quickly we respond.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://cafe1luton.co.uk/complaints" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://cafe1luton.co.uk/complaints" }],
  }),
  component: () => (
    <LegalPage
      title="Complaints Policy"
      intro="If something isn't right, we want to know. Most issues are sorted the same day."
    >
      <Section heading="How to complain">
        <p>
          Speak to a member of the team in the café, call us, or email info@cafe1luton.co.uk with
          your order number, the date and what went wrong. Photos help for food quality or missing
          item issues.
        </p>
      </Section>
      <Section heading="Our response times">
        <ul className="list-disc space-y-1 pl-5">
          <li>Acknowledgement: within 1 working day.</li>
          <li>Full response: within 5 working days.</li>
          <li>Complex cases: we'll tell you if we need longer and keep you updated.</li>
        </ul>
      </Section>
      <Section heading="Putting it right">
        <p>
          Depending on the issue we will remake the item, refund the item or the order, or credit
          your account. Card refunds are returned to the original card via SumUp and usually appear
          within 3–5 working days.
        </p>
      </Section>
      <Section heading="Food safety and allergens">
        <p>
          Report suspected allergen or food safety issues immediately by phone so we can act at
          once. These are escalated to the café manager the same day.
        </p>
      </Section>
      <Section heading="If you're still unhappy">
        <p>
          Ask for your complaint to be escalated to the owner. You may also contact Luton Council's
          environmental health team for food safety matters, or Citizens Advice for consumer
          matters.
        </p>
      </Section>
    </LegalPage>
  ),
});
