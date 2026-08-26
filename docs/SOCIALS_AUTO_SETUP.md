# Automatic Socials and Google Reviews setup

The `/socials` page supports automatic YouTube uploads, Instagram Reels, the
official TikTok creator profile, the official Facebook Page timeline and live
Google reviews. Existing `VITE_SOCIAL_EMBEDS_JSON` posts remain a safe fallback.

All API credentials below are server-only. Store them in the Lovable production
secret manager and never add them to a `VITE_` variable or commit them to Git.

## TikTok and Facebook

These use the official public profile embeds and do not require API tokens. TikTok is rendered by
its supported creator-profile embed script rather than an unsupported profile iframe:

```text
VITE_SOCIAL_TIKTOK_URL=https://www.tiktok.com/@cafe1.luton
VITE_SOCIAL_FACEBOOK_URL=https://www.facebook.com/Cafe1luton
```

Visitors must allow marketing cookies before either provider is loaded. The paused card now offers
a one-tap **Allow and show** action; analytics remains off unless the visitor separately allows it.

## YouTube automatic uploads

The simplest setup needs no API key. Copy the channel's public `UC...` ID and set:

```text
YOUTUBE_CHANNEL_ID=UC1234567890123456789012
```

The server reads YouTube's public uploads feed. If you need to configure by handle or uploads
playlist instead, create a restricted YouTube Data API v3 key and set exactly one source:

```text
YOUTUBE_API_KEY=server-only-key
YOUTUBE_CHANNEL_HANDLE=@YOUR_CHANNEL
```

Alternatively use `YOUTUBE_UPLOADS_PLAYLIST_ID`. The server requests up to six public uploads,
caches successful results for 15 minutes and never sends an API key to the browser.

## Instagram automatic Reels

Connect the Café 1 Instagram Professional account through Meta's Instagram API
with Instagram Login, then set:

```text
INSTAGRAM_ACCESS_TOKEN=server-only-long-lived-token
INSTAGRAM_GRAPH_VERSION=v23.0
```

Only official video/Reel permalinks are accepted. Images and malformed or
untrusted URLs are discarded.

## Google Reviews

Set the Café 1 Place ID and a server-restricted Places API (New) key:

```text
GOOGLE_PLACE_ID=the-cafe-place-id
GOOGLE_MAPS_API_KEY=server-only-key
```

The server tries the Lovable connector first when `LOVABLE_API_KEY` is present,
then falls back to the official Places API endpoint. The key is passed only in
a server request header and is never exposed to visitors.

## Deployment acceptance

1. Run `npm run validate:production-env` in the secret-bearing environment.
2. Deploy the exact final `main` commit and set `PUBLIC_RELEASE_SHA` to that
   full 40-character SHA.
3. Reject marketing cookies and confirm no TikTok, Facebook, Instagram or
   YouTube request is made.
4. Allow marketing cookies and test every configured provider on phone and
   desktop.
5. Confirm every player and review remains linked to its original source.
6. Run `EXPECTED_RELEASE_SHA=<final-sha> npm run smoke:production --
https://cafe1luton.co.uk` and retain the evidence.
