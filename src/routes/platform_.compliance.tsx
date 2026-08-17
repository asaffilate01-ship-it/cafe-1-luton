import { createFileRoute, Link } from "@tanstack/react-router";
import { PlatformShell } from "@/components/platform-layout";
import { Section } from "@/components/legal-layout";
import {
  ShieldCheck,
  Lock,
  Cookie,
  FileCheck,
  Server,
  Eye,
  CreditCard,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/platform_/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance & Trust — dishbee" },
      {
        name: "description",
        content:
          "How the dishbee handles security, privacy, payments, accessibility and regulatory compliance for independent hospitality venues.",
      },
      { property: "og:title", content: "Compliance & Trust — dishbee" },
      {
        property: "og:description",
        content: "Security, privacy, payments, accessibility and compliance information for the dishbee.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://dishbee.co.uk/platform/compliance" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://dishbee.co.uk/platform/compliance" }],
  }),
  component: PlatformCompliance,
});

function Badge({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm">
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </span>
  );
}

function PlatformCompliance() {
  return (
    <PlatformShell>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Compliance &amp; Trust</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 26 July 2026</p>
        <p className="mt-4 text-muted-foreground">
          dishbee is built for hospitality venues that need to protect customer data, prove
          payment security and stay accessible to every guest.
        </p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <Section heading="Security by design">
            <div className="flex flex-wrap gap-2">
              <Badge icon={Lock} label="HTTPS in transit" />
              <Badge icon={Server} label="Role-based access control" />
              <Badge icon={Eye} label="Audit logging" />
              <Badge icon={ShieldCheck} label="Row-level database security" />
            </div>
            <p className="mt-4">
              Every tenant is deployed with its own database isolation, role-based access, and row-level
              security policies. Staff, drivers, kitchen and admin roles each see only the data they need.
              Changes to sensitive settings are logged and can be reviewed in the operator dashboard.
            </p>
          </Section>

          <Section heading="Privacy &amp; GDPR">
            <div className="flex flex-wrap gap-2">
              <Badge icon={Cookie} label="Cookie consent" />
              <Badge icon={FileCheck} label="Data request workflows" />
              <Badge icon={ShieldCheck} label="Lawful-basis purpose limiting" />
            </div>
            <p className="mt-4">
              We collect the minimum data needed to take, prepare and deliver an order. Card details are
              handled by SumUp and never stored by us. Cookie consent is required before any analytics or
              marketing storage loads, and customers can request data deletion or export through the venue
              contact. Each tenant's own privacy notice explains their specific data use.
            </p>
          </Section>

          <Section heading="Payments">
            <div className="flex flex-wrap gap-2">
              <Badge icon={CreditCard} label="SumUp card processing" />
              <Badge icon={Lock} label="No card data stored" />
            </div>
            <p className="mt-4">
              Online, till and card-reader payments are processed by SumUp, which maintains its own PCI DSS
              compliance programme. The platform stores only a payment reference and status, never the full
              card number, CVV or PIN.
            </p>
          </Section>

          <Section heading="Accessibility">
            <p>
              The ordering interface is designed for touch, keyboard and screen-reader use, with semantic
              headings, ARIA labels, skip links, and contrast-checked colour schemes. We keep legacy browser
              compatibility in mind for older hospitality hardware and tablets.
            </p>
          </Section>

          <Section heading="Food safety &amp; allergens">
            <p>
              The menu system supports allergen tagging, item-level notes, and clear customer-facing warnings.
              Orders print to the kitchen with the same notes that the customer sees, so staff can act on
              dietary requests consistently. Venue-specific food hygiene procedures remain the responsibility
              of the operator.
            </p>
          </Section>

          <Section heading="Legal documents">
            <p>
              The live venue site, Café 1 St Albans, publishes its own legal pages. We recommend every tenant
              adapts and hosts equivalent documents for their own business:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <Link to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-primary hover:underline">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="text-primary hover:underline">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to="/gdpr" className="text-primary hover:underline">
                  GDPR &amp; Data Rights
                </Link>
              </li>
              <li>
                <Link to="/complaints" className="text-primary hover:underline">
                  Complaints
                </Link>
              </li>
            </ul>
          </Section>

          <Section heading="Questions">
            <p>
              If you need a security questionnaire, DPA or compliance review for your business, email us at{" "}
              <a
                href="mailto:hello@cafe1stalbans.co.uk?subject=Platform%20compliance%20question"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="h-4 w-4" />
                hello@cafe1stalbans.co.uk
              </a>
              .
            </p>
          </Section>
        </div>
        <div className="mt-12 rounded-2xl border border-border bg-secondary/40 p-5 text-sm">
          <p className="font-semibold">Contact us</p>
          <p className="mt-1 text-muted-foreground">
            Cafe 1, St Albans Crown Court, AL1 3JU ·{" "}
            <a className="text-primary underline underline-offset-2" href="mailto:info@cafe1stalbans.co.uk">
              info@cafe1stalbans.co.uk
            </a>
          </p>
        </div>
      </main>
    </PlatformShell>
  );
}
