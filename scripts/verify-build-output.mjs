import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputHeaders = resolve(".output/public/_headers");
let content;

try {
  content = await readFile(outputHeaders, "utf8");
} catch (error) {
  console.error(
    `Build output verification failed: ${outputHeaders} is missing. Run npm run build first.`,
  );
  if (process.env.CI !== "true") console.error(error);
  process.exit(1);
}

const requiredPrivatePatterns = [
  "/api/*",
  "/admin/*",
  "/staff/*",
  "/till/*",
  "/kds/*",
  "/driver/*",
  "/display/*",
  "/pay/*",
  "/order/*",
  "/print/*",
  "/account/*",
  "/tab/*",
  "/checkout/*",
  "/cart/*",
  "/lovable/*",
];

const failures = [];
const blocks = content.split(/(?=^\/)/m);

for (const pattern of requiredPrivatePatterns) {
  const block = blocks.find((candidate) => candidate.startsWith(`${pattern}\n`));
  if (!block) {
    failures.push(`${pattern}: route block is missing`);
    continue;
  }

  if (!/^  cache-control:.*\bprivate\b.*\bno-store\b/im.test(block)) {
    failures.push(`${pattern}: private, no-store cache-control is missing`);
  }
  if (!/^  pragma:\s*no-cache\s*$/im.test(block)) {
    failures.push(`${pattern}: pragma no-cache is missing`);
  }
  if (!/^  expires:\s*0\s*$/im.test(block)) {
    failures.push(`${pattern}: expires 0 is missing`);
  }
}

if (failures.length) {
  console.error(
    `Build output verification failed:\n${failures.map((item) => `- ${item}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(
  `Build output verification passed for ${requiredPrivatePatterns.length} private route families.`,
);
