import { createFileRoute, Link } from "@tanstack/react-router";
import { PlatformShell } from "@/components/platform-layout";
import { Section } from "@/components/legal-layout";
import { usePlatformI18n } from "@/components/platform-i18n-provider";
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
          "How dishbee handles security, privacy, payments, accessibility and regulatory compliance for independent hospitality venues.",
      },
      { property: "og:title", content: "Compliance & Trust — dishbee" },
      {
        property: "og:description",
        content: "Security, privacy, payments, accessibility and compliance information for dishbee.",
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

const securityIcons = [Lock, Server, Eye, ShieldCheck];
const privacyIcons = [Cookie, FileCheck, ShieldCheck];
const paymentIcons = [CreditCard, Lock];
const legalHrefs = ["/privacy", "/terms", "/cookies", "/gdpr", "/complaints"] as const;

function PlatformCompliance() {
  return (
    <PlatformShell>
      <ComplianceContent />
    </PlatformShell>
  );
}

function ComplianceContent() {
  const { t } = usePlatformI18n();
  const c = t.compliance;
  return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{c.heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{c.updated}</p>
        <p className="mt-4 text-muted-foreground">{c.lead}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground/90">
          <Section heading={c.security.heading}>
            <div className="flex flex-wrap gap-2">
              {c.security.badges.map((label, i) => (
                <Badge key={label} icon={securityIcons[i] ?? ShieldCheck} label={label} />
              ))}
            </div>
            <p className="mt-4">{c.security.body}</p>
          </Section>

          <Section heading={c.privacy.heading}>
            <div className="flex flex-wrap gap-2">
              {c.privacy.badges.map((label, i) => (
                <Badge key={label} icon={privacyIcons[i] ?? ShieldCheck} label={label} />
              ))}
            </div>
            <p className="mt-4">{c.privacy.body}</p>
          </Section>

          <Section heading={c.payments.heading}>
            <div className="flex flex-wrap gap-2">
              {c.payments.badges.map((label, i) => (
                <Badge key={label} icon={paymentIcons[i] ?? CreditCard} label={label} />
              ))}
            </div>
            <p className="mt-4">{c.payments.body}</p>
          </Section>

          <Section heading={c.accessibility.heading}>
            <p>{c.accessibility.body}</p>
          </Section>

          <Section heading={c.food.heading}>
            <p>{c.food.body}</p>
          </Section>

          <Section heading={c.legal.heading}>
            <p>{c.legal.body}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {c.legal.links.map((label, i) => (
                <li key={label}>
                  <Link to={legalHrefs[i]} className="text-primary hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section heading={c.questions.heading}>
            <p>
              {c.questions.bodyBefore}
              <a
                href="mailto:hello@dishbee.co.uk?subject=Platform%20compliance%20question"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <Mail className="h-4 w-4" />
                hello@dishbee.co.uk
              </a>
              {c.questions.bodyAfter}
            </p>
          </Section>
        </div>
        <div className="mt-12 rounded-2xl border border-border bg-secondary/40 p-5 text-sm">
          <p className="font-semibold">{c.contactBox}</p>
          <p className="mt-1 text-muted-foreground">
            <a className="text-primary underline underline-offset-2" href="mailto:hello@dishbee.co.uk">
              hello@dishbee.co.uk
            </a>
          </p>
        </div>
      </main>
  );
}
