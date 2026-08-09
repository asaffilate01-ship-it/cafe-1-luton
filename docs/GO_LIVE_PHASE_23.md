# Go-live phase 23: automatic social content

Phase 23 removes the empty Socials-page dependency on manually maintained post
JSON while retaining manual posts as a fallback.

## Delivered

- Automatic public YouTube upload discovery through YouTube Data API v3.
- Automatic Instagram video and Reel discovery through Instagram API.
- Official Facebook Page timeline and TikTok creator embeds.
- Marketing-consent gating before any social provider is loaded.
- Accessible horizontal video carousel for phone, tablet and desktop.
- Direct Google Places API fallback when the Lovable connector is unavailable.
- Server-only credentials, provider timeouts, bounded results and short failure
  retries.
- Production configuration validation and regression tests.

## Still operational

The code cannot create or approve provider credentials. Operations must connect
the official Café 1 accounts, store secrets in Lovable, deploy the final commit
and record phone/desktop acceptance evidence. The existing 27 operational gates
and 52-item go-live checklist remain the authority for production approval.
