# Phase 20: live release drift visibility

Phase 20 makes the GitHub-versus-production comparison repeatable. It does not
deploy a release or claim operational acceptance.

## Observed baseline

On 9 August 2026 the GitHub `main` candidate was
`5e4805fd2b71399010ec90861a86d6d49940eb1b`, while the production health endpoint
reported `250b751d99988b92b390fd92aa4b70a25e2fb965`. Production was 20 commits
behind and the exact-candidate production smoke result was 7/19. The eleven
protected routes did not yet expose the candidate's private/no-store headers,
and the health release identity did not match.

## Changes in this phase

1. `npm run release:live-delta` queries `/api/public/health`, compares the
   deployed release with the local candidate and emits a machine-readable
   status: `in_sync`, `behind`, `ahead`, `diverged`, `different` or
   `unconfigured`. `different` is used when a shallow checkout cannot safely
   prove the commit relationship.
2. The report includes exact release identities, postcode and commit distance
   when both commits are in the repository history.
3. `--strict` exits unsuccessfully unless production is the exact candidate;
   `--json <path>` writes evidence for review or a release record.
4. Unit tests cover exact, behind, unconfigured and divergent outcomes.

## Use for the final candidate

1. Commit the complete release candidate and note its exact 40-character SHA.
2. Set production `PUBLIC_RELEASE_SHA` to that final SHA, not the older Phase 18
   SHA and not a branch name.
3. Deploy the same commit and apply all Supabase migrations.
4. Run `npm run release:live-delta -- --expected <FINAL_SHA> --strict`.
5. Run Production smoke and require 19/19 for the same SHA.
6. Complete the 27 operational gates, 48 checklist items and named approvals.

The final three steps require the real production host, payment account,
hardware, staff and approvers. Software cannot safely mark them complete in
advance.
