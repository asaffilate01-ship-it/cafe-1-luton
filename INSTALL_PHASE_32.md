# Install Café 1 Phase 32

This cumulative source is based on GitHub `main` commit
`cf00a4f49cc1e0cd14d25bb534844093ebd16f6a` and includes Phases 29–32.

1. Create a branch from that exact commit and copy the supplied files over the checkout without
   removing unrelated files.
2. Apply outstanding Supabase migrations, including
   `20260811110000_sumup_split_sale_kds_dedupe.sql`.
3. Run `npm ci`, `npm run release:guard`, `npm run check` and `npm audit --omit=dev`.
4. Push the branch and open a protected pull request. Require Application, Supabase pgTAP, CodeQL
   and Browser journeys.
5. Merge, deploy the exact resulting `main` SHA, set `PUBLIC_RELEASE_SHA` to that SHA and redeploy.
6. Run the exact-SHA production smoke, then verify anonymous `/`, `/menu` and `/socials` responses
   show the public CDN policy while `/cart`, `/checkout`, `/admin`, `/till` and `/kds` remain
   `private, no-store`.
7. Complete the physical phone/tablet till, SumUp, printer, drawer, display, KDS and Deliveroo tests
   and record their real evidence before launch approval.

If Cloudflare does not honour `CDN-Cache-Control`, create an edge cache rule limited to the public
allowlist in `src/lib/public-cache.ts`. Never cache a request containing a cookie or Authorization
header, and never include a private route.
