# Café 1 socials and live Google reviews

The public `/socials` page uses official source players. It never copies a video
into the Café 1 application, and it does not load Facebook, Instagram, TikTok or
YouTube until the visitor has allowed marketing cookies.

## 1. Official profile links

Set the profile URLs in the production host. Public `VITE_` values are not
secrets, but each URL is validated against the expected platform domain.

```text
VITE_SOCIAL_FACEBOOK_URL=https://www.facebook.com/YOUR_PAGE
VITE_SOCIAL_INSTAGRAM_URL=https://www.instagram.com/YOUR_ACCOUNT/
VITE_SOCIAL_TIKTOK_URL=https://www.tiktok.com/@cafe1_stalbans
VITE_SOCIAL_YOUTUBE_URL=https://www.youtube.com/@YOUR_CHANNEL
```

## 2. Featured reels and videos

Upload the video to its normal social platform first, copy its public URL, then
add it to `VITE_SOCIAL_EMBEDS_JSON`. The page accepts up to eight validated,
unique entries from `facebook`, `instagram`, `tiktok` and `youtube`.

```json
[
  {
    "platform": "instagram",
    "url": "https://www.instagram.com/reel/REEL_CODE/",
    "title": "Today's lunch special"
  },
  {
    "platform": "tiktok",
    "url": "https://www.tiktok.com/@cafe1_stalbans/video/VIDEO_ID",
    "title": "Behind the counter"
  },
  {
    "platform": "youtube",
    "url": "https://www.youtube.com/shorts/VIDEO_ID",
    "title": "Café 1 in 30 seconds"
  }
]
```

Enter the JSON as one line in the host environment-value field. Redeploy the
same final Git commit after changing public build variables.

## 3. Live Google reviews

Find the Google Place ID for the St Albans Café 1 listing and set:

```text
GOOGLE_PLACE_ID=the-google-place-id
```

The existing server-only `LOVABLE_API_KEY` and `GOOGLE_MAPS_API_KEY` are used to
call Places API (New) through the Lovable connector gateway. Add **Places API
(New)** to that server key's API restrictions alongside the already-used
Geocoding API and Routes API. Do not put the server key in any `VITE_` value.

Reviews are requested server-side, limited to five, cached for 15 minutes and
rendered with their author attribution and a link back to Google. If Google is
unavailable or the Place ID has not been configured, the page fails safely to a
Google-listing link instead of breaking.

## 4. Acceptance

After deployment:

1. Confirm `/about` and `/socials` work on phone and desktop.
2. Reject marketing cookies and prove no social iframe is loaded.
3. Allow marketing cookies and play one item from every configured platform.
4. Confirm every player opens the original source post.
5. Compare the displayed rating, review count and review authors with the live
   Google listing.
6. Run the production smoke workflow for the exact deployed SHA and retain its
   evidence URL.
