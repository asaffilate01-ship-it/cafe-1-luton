# Café 1 Phase 27 delivery

This is a complete project update based on GitHub `main` commit
`c846ff83c800221c4e4449d3cc30e9618af4d0c9`. It repairs the Socials experience and adds a second
mobile POS alignment/polish pass. It has not been committed or deployed, so the final release SHA
does not exist yet.

## Socials repaired

- TikTok creator content now uses TikTok's supported creator-profile embed script instead of the
  non-working profile iframe URL.
- A visitor can use **Allow and show** directly on a paused social card. This grants marketing
  consent only and preserves their separate analytics choice.
- YouTube can now auto-update from its public channel feed using only `YOUTUBE_CHANNEL_ID`; a
  YouTube API key is no longer required for that route.
- Instagram Reels still use the official server-side Instagram API connection.
- Empty or temporarily unavailable feeds now show useful official-profile links instead of an
  internal-looking configuration message.
- TikTok, Facebook, Instagram and YouTube players remain blocked before marketing consent.

## Mobile/tablet till improved

- Narrow-phone header columns are constrained and the shift label truncates safely instead of
  pushing the menu off-screen.
- The entire till and split workspace now enforce `min-width: 0`, viewport width and overflow
  containment.
- Product density stays at two useful columns on normal phones and moves to three only at 560 px.
- The mobile order drawer is a true `100dvh` viewport with a safe-area-aware header, back control,
  fulfilment summary, item count and live total.
- Basket rows use a stable two-column layout with separated description, price/delete controls and
  larger quantity controls.
- The bottom action is now a premium **View order** control with a count badge, clear status and
  total rather than a cramped single-line label.
- Responsive browser coverage now includes 320, 360, 390 and 430 px phones plus a 768 px tablet.

## Production settings still needed for live content

The public Facebook, Instagram and TikTok profile URLs already have Café 1 defaults. For automatic
YouTube uploads, set the real public channel details:

```text
VITE_SOCIAL_YOUTUBE_URL=https://www.youtube.com/@YOUR_CHANNEL
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxx
```

For automatic Instagram Reels and live Google reviews, configure these existing server-only
connections in Lovable's production environment:

```text
INSTAGRAM_ACCESS_TOKEN=your-server-only-long-lived-token
INSTAGRAM_GRAPH_VERSION=v23.0
GOOGLE_PLACE_ID=your-cafe1-google-place-id
GOOGLE_MAPS_API_KEY=your-server-restricted-places-key
```

Never add access tokens or API keys to a `VITE_` variable or GitHub.

## Verification

- `npm run check`: passed
- 114/114 application tests passed
- 54/54 release and security tests passed
- 26/26 software capability controls passed
- 82 migrations, 68 source routes and 15 private route families passed
- production build and bundle budget passed
- release guard: 523 files passed
- production dependency audit: zero vulnerabilities

The responsive Playwright suite lists and compiles all five till viewport cases. This workspace
could not execute Chromium because the browser CDN returned an empty/truncated archive. GitHub
Actions and real café hardware acceptance remain required.

## Commit and deploy

```bash
npm ci
npm run check
git add --all
git commit -m "Phase 27 repair social feeds and polish mobile POS"
git rev-parse HEAD
```

Set production `PUBLIC_RELEASE_SHA` to that exact new 40-character SHA, deploy the same commit and
run the production smoke workflow. Do not call the release 100% until the 28 operational evidence
gates have real references, operators and dates.
