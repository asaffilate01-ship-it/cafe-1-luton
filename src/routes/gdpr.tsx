import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/legal-layout";

export const Route = createFileRoute("/gdpr")({
  head: () => ({
    meta: [
      { title: "GDPR & Your Data Rights — Café 1 St Albans" },
      { name: "description", content: "Your UK GDPR rights at Café 1: access, correction, deletion, portability and how to make a data request." },
      { property: "og:title", content: "GDPR & Your Data Rights — Café 1" },
      { property: "og:description", content: "How to exercise your UK GDPR rights with Café 1." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/gdpr" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/gdpr" }],
  }),
  component: () => (
    <LegalPage
      title="GDPR & Your Data Rights"
      intro="Café 1 handles personal data in line with the UK GDPR and the Data Protection Act 2018. This page is maintained by Café 1 and explains the rights you can exercise."
    >
      <Section heading="Your rights">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Access</b> — a copy of the personal data we hold about you.</li>
          <li><b>Rectification</b> — correction of inaccurate or incomplete details.</li>
          <li><b>Erasure</b> — deletion, where we don't need to keep records by law.</li>
          <li><b>Restriction</b> — pause processing while a query is resolved.</li>
          <li><b>Portability</b> — your data in a common machine-readable format.</li>
          <li><b>Objection</b> — object to processing based on legitimate interests.</li>
          <li><b>Withdraw consent</b> — for marketing and non-essential cookies, at any time.</li>
        </ul>
      </Section>
      <Section heading="How to make a request">
        <p>Email info@cafe1stalbans.co.uk with the subject "Data request", telling us which right you want to use and the name, phone number or email you used when ordering. We may ask for proof of identity to protect your data.</p>
      </Section>
      <Section heading="How long it takes">
        <p>We respond within one calendar month. If a request is complex we may extend this by up to two further months and will explain why. Requests are free unless clearly unfounded or excessive.</p>
      </Section>
      <Section heading="Data we must keep">
        <p>Financial and order records are retained for six years to meet HMRC requirements, even after an account is deleted. Remaining personal details are removed or anonymised.</p>
      </Section>
      <Section heading="Security">
        <p>Access to order and customer data is restricted to café staff accounts with role-based permissions. Card details are handled entirely by SumUp and never stored by Café 1.</p>
      </Section>
      <Section heading="Complaints to the regulator">
        <p>If you're unhappy with how we've handled your data you can complain to the Information Commissioner's Office at ico.org.uk or on 0303 123 1113.</p>
      </Section>
    </LegalPage>
  ),
});