# Phase 18: menu-rule assurance and verified acceptance evidence

Phase 18 formalises two capabilities that are already required for launch: the
complete Cafe 1 catalogue must enforce modifier rules at every ordering entry
point, and automated GitHub evidence must be recorded only when it belongs to
the exact release candidate. It does not mark any real payment, hardware,
legal, recovery or staff exercise as passed.

## Changes in this phase

1. The August 2026 menu and modifier delivery is now part of the release
   capability contract. Public ordering, till ordering and server functions
   share required-choice, maximum-choice and exclusive-option validation.
2. The kids meal wording remains **Includes a cup of cordial**, with a required
   zero-cost cordial flavour choice.
3. A new **Record verified release evidence** workflow accepts GitHub Actions
   run URLs, retrieves the run metadata through the repository token and rejects
   the wrong repository, workflow, commit, conclusion or required job.
4. A verified Production checks run records the application and database gates;
   Browser journeys and CodeQL record their corresponding gates. Successful
   Production smoke and Release candidate evidence runs can be supplied after
   deployment to record two additional gates.
5. The workflow changes only those six automatable gates. It creates a draft PR
   for review and leaves SumUp, printer, cash drawer, display, KDS, MFA, restore,
   HMCTS, monitoring and staff gates untouched.
6. If repository settings prevent GitHub Actions from opening a PR, the verified
   acceptance record is still retained as a workflow artifact for manual review.
7. The machine-verifiable software capability contract is now 15/15.

## Use after selecting the final candidate

1. Resolve or close obsolete PRs before deployment. The current `main` tree
   already contains the menu/modifier payload from draft PR #14, so do not apply
   the same migration or source patch again.
2. Set `PUBLIC_RELEASE_SHA` to the final 40-character candidate commit and
   deploy that exact commit.
3. Require successful **Production checks**, **Browser journeys**, **CodeQL**,
   **Production smoke** and **Release candidate evidence** runs for the same SHA.
4. Run **Record verified release evidence**, enter the five run URLs and type
   `RECORD-CAFE1`.
5. Review and merge the generated evidence PR. Continue recording physical and
   operational gates only after the real test has been performed and its safe
   evidence reference is available.

The strict promotion workflow still requires 27/27 operational gates, 48/48
checklist items, exact-SHA 19/19 production smoke and named technical and
operations approval.
