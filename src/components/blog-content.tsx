import type { ReactNode } from "react";

function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function inlineMarkdown(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = safeHref(link[2]);
        if (!href) return <span key={index}>{link[1]}</span>;
        const external = href.startsWith("https://");
        return (
          <a
            key={index}
            href={href}
            rel={external ? "noopener noreferrer" : undefined}
            target={external ? "_blank" : undefined}
            className="font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            {link[1]}
          </a>
        );
      }
      return part;
    });
}

export function BlogContent({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}/);
  return (
    <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("### "))
          return (
            <h3 key={index} className="mt-8 font-display text-xl font-bold">
              {inlineMarkdown(trimmed.slice(4))}
            </h3>
          );
        if (trimmed.startsWith("## "))
          return (
            <h2 key={index} className="mt-10 font-display text-2xl font-bold">
              {inlineMarkdown(trimmed.slice(3))}
            </h2>
          );
        if (trimmed.startsWith("# "))
          return (
            <h2 key={index} className="mt-10 font-display text-3xl font-bold">
              {inlineMarkdown(trimmed.slice(2))}
            </h2>
          );
        if (trimmed.startsWith("> "))
          return (
            <blockquote
              key={index}
              className="mt-4 border-l-4 border-primary bg-primary-soft/40 px-4 py-3 italic"
            >
              {inlineMarkdown(trimmed.slice(2))}
            </blockquote>
          );
        if (/^[-*] /.test(trimmed)) {
          const items = trimmed.split(/\n/).map((line) => line.replace(/^[-*]\s+/, ""));
          return (
            <ul key={index} className="mt-4 list-disc space-y-2 pl-6">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{inlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        if (/^\d+[.)]\s+/.test(trimmed)) {
          const items = trimmed.split(/\n/).map((line) => line.replace(/^\d+[.)]\s+/, ""));
          return (
            <ol key={index} className="mt-4 list-decimal space-y-2 pl-6">
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{inlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={index} className="mt-4 leading-7">
            {inlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
