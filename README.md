# AE-LINK Backend

Deferred deep linking platform built with Next.js 14, TypeScript, MongoDB, and Mongoose. Deployed on Vercel.

**Live:** Your deployment domain (e.g., `https://aelink.vercel.app`)
**Repos:** [Backend](https://github.com/DabhiNavaghan/ae-link-backend) · [Flutter SDK](https://github.com/DabhiNavaghan/ae-link)

## What It Does

AE-LINK creates short links that intelligently route users based on their platform. When a mobile user clicks a link but doesn't have the app installed, the system collects a device fingerprint, redirects to the app store, and later matches that fingerprint when the app is launched for the first time — delivering the original link's context (event ID, UTM params, coupon codes, etc.) into the app.

## How the Flow Works

```
Email/SMS/Social → User clicks aelink.vercel.app/TG5hid0
                         ↓
              Redirect page (SSR + client JS)
              ├── Records click
              ├── Collects browser fingerprint
              ├── Creates DeferredLink record
              └── Redirects based on platform:
                  ├── Desktop → web destination URL
                  ├── Android → Play Store
                  └── iOS → App Store
                         ↓
              User installs app, launches it
                         ↓
              Flutter SDK collects device fingerprint
              → POST /api/v1/deferred/match
              → Server matches against stored browser fingerprints
              → Returns original link data (event, params, UTMs)
                         ↓
              App navigates to the right screen
              → POST /api/v1/deferred/confirm
```

## Fingerprint Matching Algorithm

The matching algorithm scores device signals that persist between browser and native app. User-Agent is intentionally excluded since browser UA (Chrome/Safari) never matches the app UA (Dart HTTP client).

| Signal | Points | Notes |
|--------|--------|-------|
| IP address | 40 | Same network = strong signal. Server enriches from request headers |
| Screen resolution | 20 | Physical pixels. Fuzzy match (±10%) scores 12 |
| Timezone | 15 | IANA name match, offset fallback, or resolved local time comparison |
| Language/locale | 10 | Normalized (`en-US` / `en_US` both match). Partial base match = 5 |
| Time proximity | 15 | ≤1h = 15, ≤6h = 12, ≤24h = 8, ≤48h = 4, >48h = 1 |
| **Total** | **100** | **Threshold: 60 points** (IP + screen alone meets it) |

## Tech Stack

- **Next.js 14** App Router with API routes
- **TypeScript** strict mode
- **MongoDB + Mongoose** with TTL indexes for auto-cleanup
- **Pino** structured logging
- **Vercel** serverless deployment

## Quick Start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your MONGODB_URI
npm run dev
# → http://localhost:3000
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `NODE_ENV` | Yes | `development` or `production` |
| `NEXT_PUBLIC_APP_URL` | Yes | Your deployment URL (e.g., `https://aelink.vercel.app`) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |

## Project Structure

```
src/
├── app/
│   ├── [shortCode]/page.tsx          # SSR redirect page
│   ├── api/v1/
│   │   ├── links/route.ts            # CRUD links
│   │   ├── campaigns/route.ts        # CRUD campaigns
│   │   ├── apps/route.ts             # CRUD apps (Android/iOS config)
│   │   ├── fingerprint/route.ts      # Store browser fingerprint
│   │   ├── deferred/
│   │   │   ├── match/route.ts        # Match device fingerprint
│   │   │   └── confirm/route.ts      # Confirm deferred link shown
│   │   ├── analytics/                # Overview, per-link, per-campaign
│   │   └── tenants/route.ts          # Register/get tenant
│   └── dashboard/                    # Full admin dashboard
│       ├── page.tsx                   # Home with stats
│       ├── apps/                     # App management (Android/iOS)
│       ├── links/                    # Link management + detail
│       ├── campaigns/                # Campaign management
│       ├── analytics/                # Analytics views
│       ├── settings/                 # API keys, app config
│       ├── docs/                     # Integration docs
│       └── setup/                    # First-time setup wizard
├── components/
│   ├── RedirectPage.tsx              # Client component (fingerprinting + redirect)
│   └── ui/                           # Shared UI components
├── lib/
│   ├── models/                       # Mongoose models
│   │   ├── Tenant.ts
│   │   ├── App.ts                    # Per-app Android/iOS config
│   │   ├── Campaign.ts
│   │   ├── Link.ts                   # Links with optional appId reference
│   │   ├── Click.ts
│   │   ├── Fingerprint.ts            # Browser fingerprints with TTL
│   │   ├── DeferredLink.ts           # Pending matches with TTL
│   │   └── Conversion.ts
│   ├── services/
│   │   ├── link.service.ts
│   │   ├── fingerprint.service.ts    # Scoring algorithm
│   │   ├── deferred.service.ts       # Create/match/confirm deferred links
│   │   ├── campaign.service.ts
│   │   ├── analytics.service.ts
│   │   └── device-detector.ts        # UA parsing
│   ├── middleware/
│   │   ├── auth.ts                   # X-API-Key authentication
│   │   ├── rate-limit.ts
│   │   └── cors.ts
│   └── api.ts                        # Client-side API helper (aeLinkApi)
└── types/index.ts                    # All TypeScript interfaces
```

## API Reference

### Public (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:shortCode` | Resolve short link, collect fingerprint, redirect |
| POST | `/api/v1/fingerprint` | Store browser fingerprint + create DeferredLink |

### Authenticated (X-API-Key header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/tenants` | Register new tenant |
| GET | `/api/v1/tenants` | Get tenant info |
| POST | `/api/v1/tenants/regenerate-key` | Regenerate API key |
| GET/POST | `/api/v1/links` | List / create links |
| GET/PUT/DELETE | `/api/v1/links/:id` | Get / update / delete link |
| GET/POST | `/api/v1/apps` | List / create apps |
| GET/PUT/DELETE | `/api/v1/apps/:id` | Get / update / soft-delete app |
| GET/POST | `/api/v1/campaigns` | List / create campaigns |
| GET/PUT/DELETE | `/api/v1/campaigns/:id` | Get / update / delete campaign |
| POST | `/api/v1/deferred/match` | Match device fingerprint (Flutter SDK) |
| POST | `/api/v1/deferred/confirm` | Confirm deferred link shown |
| GET | `/api/v1/analytics/overview` | Dashboard stats |
| GET | `/api/v1/analytics/links/:id` | Per-link analytics |
| GET | `/api/v1/analytics/campaigns/:id` | Per-campaign analytics |

### Example: Create a Link

```bash
curl -X POST https://aelink.vercel.app/api/v1/links \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Summer Festival",
    "destinationUrl": "https://allevents.in/event/summer-fest",
    "linkType": "event",
    "params": {
      "eventId": "12345",
      "action": "view_event",
      "utmSource": "email",
      "utmCampaign": "summer-promo"
    }
  }'
```

## Database Models

| Model | Purpose | TTL |
|-------|---------|-----|
| **Tenant** | Organization/account with API key | — |
| **App** | Per-app Android/iOS store URLs and config | — |
| **Campaign** | Groups links for organized tracking | — |
| **Link** | Short link with destination, params, optional appId | Optional expiry |
| **Click** | Each link click with device/geo data | — |
| **Fingerprint** | Browser fingerprint from redirect page | 72h (configurable) |
| **DeferredLink** | Links fingerprint → link data, awaiting app match | 72h (configurable) |
| **Conversion** | App-side conversion events | — |

## Deployment

```bash
# Vercel (recommended)
vercel deploy --prod

# Set env vars in Vercel dashboard:
# MONGODB_URI, NEXT_PUBLIC_APP_URL, ALLOWED_ORIGINS
```

The dashboard dynamically uses `window.location.host` for all link URLs, so it works on any domain without code changes.

## Security

- API key authentication for all management endpoints
- CORS middleware with configurable allowed origins
- Rate limiting (100 req/min public, 1000 req/min authenticated)
- Mongoose schema validation on all inputs
- TTL indexes auto-delete expired fingerprints and deferred links
- No PII stored in fingerprints (hashed UA, no cookies)

## License

Proprietary — AllEvents 2024–2026
