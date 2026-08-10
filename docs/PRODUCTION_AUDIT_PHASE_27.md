# Café 1 Phase 27 — Socials reliability and mobile POS polish

Date: 10 August 2026

## Root causes corrected

1. The TikTok profile component used an iframe URL that was not the supported creator-profile
   embed mechanism. It now mounts TikTok's creator markup and consent-gated embed script.
2. Enabling a social player required opening the full cookie panel and understanding which category
   to select. A one-tap, marketing-only consent action now exists on every paused player.
3. Automatic YouTube uploads required an API key even though YouTube publishes a public Atom feed
   for channel IDs. The server now validates and consumes that feed with response/time limits.
4. When providers were not configured or temporarily unavailable, the public page presented an
   internal setup message. It now gives visitors useful official-channel fallbacks.
5. On very narrow tills, unconstrained header content and dense single-row basket controls could
   squeeze or overflow. The phone header, order drawer, basket rows and bottom action now use
   deterministic viewport-safe grids.

## Acceptance still required

1. Add the real Café 1 YouTube profile URL and `UC...` channel ID.
2. Confirm the Instagram long-lived token is valid and refresh it before expiry.
3. Confirm the Google Place ID and server-restricted Places API key.
4. Deploy, reject marketing consent and prove no third-party social player/script loads.
5. Use **Allow and show**, verify the TikTok creator profile and Facebook timeline, then play one
   automatic YouTube upload and Instagram Reel.
6. Test the till on an actual 320–430 px phone and portrait/landscape café tablet, completing a cash
   and SumUp order.
7. Save screenshots, operator names and dates against the operational evidence gates.
