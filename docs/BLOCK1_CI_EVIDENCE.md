# Block 1 — CI evidence runbook (3/28 → 9/28)

Goal: turn six gates green with GitHub Actions run URLs from **one exact commit**.
Gates: `application_ci`, `database_ci`, `codeql`, `browser_journeys`,
`production_smoke`, `release_evidence`.

## 0. Pre-flight (already verified locally)

| Local equivalent | Result |
| --- | --- |
| `npm run release:guard && npm run check` | pass (only `repository-hygiene` git test cannot run in a sandbox; it passes in CI) |
| `PRODUCTION_BASE_URL=https://cafe1luton.co.uk npm run smoke:production` | 35/35 checks pass |
| Workflow files present and SHA-pinned | ci, codeql, browser-e2e, production-smoke, release-candidate, record-release-evidence |

So the workflows should pass first time. Nothing else to change in code.

## 1. Push the release commit

```bash
git push origin main
export SHA=$(git rev-parse HEAD)   # 40 chars — every run URL must match this
```

## 2. Run the workflows (GitHub → Actions → Run workflow, on the same commit)

1. **Production checks** — runs automatically on push to `main`.
   Must show both jobs green: *Application* and *Supabase migrations and pgTAP*.
2. **CodeQL** — runs automatically on push; otherwise Run workflow.
3. **Browser journeys** — runs automatically on push; otherwise Run workflow.
4. Deploy that commit to production, set `PUBLIC_RELEASE_SHA=$SHA`, then run
   **Production smoke** with `base_url=https://cafe1luton.co.uk` and
   `expected_release_sha=$SHA`.
5. **Release candidate evidence** — Run workflow with `base_url` and the
   *Production checks* run URL for `database_check_run_url`.

Copy each run URL (`https://github.com/<owner>/<repo>/actions/runs/<id>`).

## 3. Record the six gates

Preferred — one command, verifies each run really is green and on `$SHA`:

```bash
npm run operational:record-github -- \
  --repository <owner>/<repo> \
  --commit "$SHA" \
  --checked-by "Your Name" \
  --production-checks-url <url> \
  --browser-url <url> \
  --codeql-url <url> \
  --production-smoke-url <url> \
  --release-candidate-url <url>
```

Needs `gh auth login` (read access to Actions) on the machine running it.

Fallback — record gates one by one:

```bash
npm run operational:record -- --gate application_ci   --status pass --evidence <url> --checked-by "Name"
npm run operational:record -- --gate database_ci      --status pass --evidence <url> --checked-by "Name"
npm run operational:record -- --gate codeql           --status pass --evidence <url> --checked-by "Name"
npm run operational:record -- --gate browser_journeys --status pass --evidence <url> --checked-by "Name"
npm run operational:record -- --gate production_smoke --status pass --evidence <url> --checked-by "Name"
npm run operational:record -- --gate release_evidence --status pass --evidence <url> --checked-by "Name"
```

Or use the **Record verified release evidence** workflow (confirmation
`RECORD-CAFE1`) to open a reviewable PR with the same result.

## 4. Confirm

```bash
npm run operational:status   # expect 9/28 passed
```

Never put keys, passwords, card numbers or customer data in `--evidence`.
Then move to Block 2 in `docs/GO_LIVE_FINAL_GUIDE.md`.
