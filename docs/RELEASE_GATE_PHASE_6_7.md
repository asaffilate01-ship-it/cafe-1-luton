# Release gates — phases 6 and 7

These phases remove the remaining known GitHub blockers without weakening security or rewriting Lovable history.

## Phase 6 — repository hygiene and stable route verification

- **Remove tracked environment files** is a manual GitHub workflow. It requires the exact confirmation `DELETE-TRACKED-ENV`, removes forbidden environment files from Git tracking, creates a normal commit and pushes without force.
- The release guard still blocks any tracked `.env`, `.dev.vars` or environment-specific `.env.*` file.
- Route validation is semantic: every source route must be imported exactly once by `src/routeTree.gen.ts`. Harmless TanStack/Lovable import ordering no longer fails CI.
- Missing, unexpected or duplicate route imports remain release-blocking.

The cleanup workflow does not erase historical values. Rotate and restrict the previously published Google Maps browser key after the cleanup commit.

## Phase 7 — continuous evidence and operational acceptance

- Production checks write a release-status artifact even when the Application job fails, making the blocker visible without exposing secrets.
- Release status records tracked environment paths and semantic route validity rather than checking generated-file formatting.
- `docs/OPERATIONAL_ACCEPTANCE_RECORD.md` provides auditable sign-off for payments, refunds, hardware, MFA, backup/restore, alerts and the staff rehearsal.

## Required sequence after upload

1. In GitHub, open **Actions → Remove tracked environment files → Run workflow**.
2. Enter `DELETE-TRACKED-ENV` and run it on `main`.
3. Confirm the cleanup commit triggers green Production checks and CodeQL.
4. Rotate/restrict the old Google Maps browser key and configure runtime values outside Git.
5. Redeploy the exact green commit.
6. Run Production smoke; `/admin/security` must return `private, no-store`.
7. Run Release Candidate Evidence and retain the artifact.
8. Protect `main`, create the release tag and record the rollback commit.
9. Complete the operational acceptance record before unrestricted customer payments.
