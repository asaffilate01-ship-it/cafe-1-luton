# Tenant & landlord model — duplicating Cafe 1 for another business

Cafe 1 St Albans is **tenant one** of the platform. The codebase is a
**clone-per-business template**: every new client gets their own copy of the app
and their own database, and the landlord (you) keeps a single control centre
that tracks all of them.

## The two roles

| Role | Where | What it does |
| --- | --- | --- |
| **Landlord** (SaaS operator) | `/landlord` on the master deployment | Creates tenants, sets plans, suspends non-payers, raises invoices, sees cross-tenant reporting |
| **Tenant** (the business) | Their own deployment, e.g. `cafe1stalbans.co.uk` | Runs their ordering site, till, KDS, drivers — completely isolated data |

The first admin to open `/landlord` can claim landlord access once. After that,
new landlord operators are added by inserting them into `landlord_admins`.

## Landlord control centre

`/landlord` (admin + landlord only) gives you:

- **Tenants** — create/edit a business (slug, trading + legal name, domain,
  deployment URL, contacts, brand colours, plan, notes), suspend and reactivate.
- **Plans** — Starter / Growth / Enterprise seeded with monthly price, included
  orders and site limits. Edit via `cafe1_save_tenant_plan`.
- **Billing** — raise a monthly invoice per tenant at the plan price, then mark
  it paid. Outstanding totals roll up on the dashboard.
- **Cross-tenant reporting** — orders, revenue and active users for the last 30
  days, per tenant and in aggregate.

## Duplicating for a new business

1. **Register the tenant** in `/landlord` — set slug, name, domain and plan.
   Press **Copy key** to get that tenant's reporting key.
2. **Remix / duplicate this project** to a new Lovable project with its own
   Cloud backend. The whole schema, RLS, RPCs and routes come with it.
3. **Rebrand** the clone:
   - `src/styles.css` — brand tokens (primary red is `--primary`).
   - `src/assets/` — logo and hero image.
   - `src/lib/nap.ts` — name, address, phone, opening hours, schema.org data.
   - `src/lib/seo.ts` + route `head()` blocks — titles, descriptions, canonical host.
   - `public/robots.txt`, `public/manifest.webmanifest`, `public/kds.webmanifest`.
4. **Reset business data** on the clone: `business_settings`, `business_hours`,
   `sites`, `menu_categories`, `menu_items`, `menu_modifiers`. Court/juror
   features are St Albans specific — leave those tables empty for other clients.
5. **Set the clone's secrets**: SumUp keys, Google Maps key, Resend key, VAPID
   pair, marketplace bridge secrets. None are shared between tenants.
6. **Point the domain** at the clone and record it on the tenant record.
7. **Wire reporting back** (below) so the clone appears in landlord reporting.

## Reporting back to the landlord

Each clone posts a daily snapshot to the master deployment:

```
POST https://<master-domain>/api/public/landlord/report
Content-Type: application/json

{
  "slug": "acme-deli",
  "key": "<reporting key from /landlord>",
  "snapshot_date": "2026-08-16",
  "orders_count": 184,
  "gross_revenue_cents": 254300,
  "active_users": 96
}
```

The endpoint verifies the key with a constant-time comparison, rejects
suspended or cancelled tenants, and upserts one row per tenant per day. Schedule
it nightly from the clone (pg_cron + `pg_net`, or any scheduler) using totals
from that clone's own `orders` table.

## Suspension

Setting a tenant to **suspended** in `/landlord`:

- stops their reporting endpoint from accepting new snapshots (HTTP 403), and
- flags them in the dashboard as non-paying.

Taking their site offline is a deployment action on their own project — the
landlord record is the commercial source of truth.

## Security notes

- `tenants`, `tenant_plans`, `tenant_invoices`, `tenant_metric_snapshots` are
  RLS-enabled with no direct policies: they are reachable only through
  `SECURITY DEFINER` RPCs that call `cafe1_assert_landlord()`, or via the
  service role inside the reporting endpoint.
- Reporting keys are never returned by the dashboard RPC. They are revealed only
  through `cafe1_reveal_tenant_key`, which also honours the
  `REQUIRE_ADMIN_MFA` manager-MFA guard, and can be rotated at any time.
- No tenant deployment can read another tenant's data — they are separate
  databases entirely.
