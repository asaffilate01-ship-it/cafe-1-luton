# Phase 15: payment-integrity and acceptance completion

Phase 15 removes the last identified repository-controlled financial-integrity
risk and makes the real-world route to 100% easier to complete without
weakening any release gate.

## Changes in this phase

1. Stale website and counter orders now use one tested age policy. Judge tabs
   and other account orders are never abandoned by automatic cleanup.
2. SumUp cleanup is fail closed. Only `FAILED`, `CANCELLED`, `CANCELED` or
   `EXPIRED` provider states may release voucher, promotion or loyalty
   reservations. `PENDING`, `PROCESSING`, unknown, malformed and unavailable
   provider results stay on hold for the next reconciliation run.
3. A paid checkout is recovered only when checkout ID, checkout reference, GBP
   amount and provider transaction ID all match the pending order.
4. Focused tests cover web/counter thresholds, invalid timestamps, account
   orders, every terminal unpaid spelling, uncertain provider states and paid
   identity mismatches.
5. Production environment validation now compares `PUBLIC_RELEASE_SHA` with
   `EXPECTED_RELEASE_SHA`, or with the current Git commit when `.git` is
   available. A plausible but incorrect 40-character SHA no longer passes.
6. `npm run operational:record` safely records one of the 27 acceptance gates.
   It validates the gate, status, evidence, operator and timestamp, writes
   atomically and rejects evidence that resembles a credential.
7. The machine-verifiable capability contract is now 10/10 and protects the
   fail-closed payment cleanup policy from accidental removal.

## Verification

Run the deterministic repository gate:

```bash
npm ci
npm run release:guard
npm run check
npm audit --omit=dev --audit-level=high
npm run release:status
```

Validate the actual secret-bearing release environment before deployment:

```bash
EXPECTED_RELEASE_SHA="$(git rev-parse HEAD)" npm run validate:production-env
```

After each real test, record its non-secret evidence reference:

```bash
npm run operational:record -- \
  --gate website_sumup \
  --status pass \
  --evidence "SumUp transaction and Cafe 1 order reference" \
  --checked-by "Release operator"
```

## Remaining external release work

This phase does not claim payment-provider, production-host, database, hardware,
HMCTS/privacy, monitoring or staff tests that have not happened. Deploy the
exact release SHA, reach 12/12 production smoke, run the GitHub application,
database, browser and CodeQL workflows, exercise the Solo, printer, cash drawer,
customer display and KDS, complete the payment/refund/reconciliation scenarios,
then record all 27 gates and named approval. Full public promotion remains
blocked until `npm run operational:check` passes.
