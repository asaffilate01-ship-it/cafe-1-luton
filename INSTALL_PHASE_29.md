# Install Café 1 Phase 29

This update is based on GitHub `main` commit
`3fe15699068a3daac75606b9825a5f4b32fea5a9` and contains the public-menu browsing choice plus the
compact, correctly layered mobile till.

## If using the update ZIP

1. Extract the ZIP into a clean clone of `asaffilate01-ship-it/cafe1-connect-dash` at the base commit
   above and allow the included files to replace their matching paths.
2. Run `npm ci`.
3. Run `npm run check`.
4. Review the changes, commit them and push to a branch or `main` through your normal protected
   workflow.
5. Deploy the final commit.
6. Set production `PUBLIC_RELEASE_SHA` to the exact 40-character SHA of that deployed commit.
7. Run `EXPECTED_RELEASE_SHA=<exact-sha> npm run smoke:production -- https://cafe1stalbans.co.uk`.

## If using the full-source ZIP

Extract it into a new folder, create a new GitHub repository if required, then install, check,
commit and deploy using steps 2–7 above. Do not upload `.env` files or production secrets.

The base SHA is not the final Phase 29 SHA. Git creates the final SHA only after these update files
are committed; production must use that new exact SHA.
