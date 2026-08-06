# AE-LINK API Documentation

Complete API reference for the AllEvents deep linking platform.

## Base URL

```
https://ae-link.allevents.app/api/v1
```

## Authentication

### API Key Authentication

Include your API key in the request header:

```
X-API-Key: your_api_key_here
```

### Getting API Key

After registering a tenant:

```bash
curl -X POST https://ae-link.allevents.app/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Organization",
    "domain": "myorg.com",
    "app": {
      "android": {
        "package": "com.allevents.app",
        "sha256": "...",
        "storeUrl": "https://play.google.com/store/apps/details?id=com.allevents.app"
      },
      "ios": {
        "bundleId": "com.allevents.app",
        "teamId": "ABCD1234",
        "appId": "com.allevents.app",
        "storeUrl": "https://apps.apple.com/app/allevents/id123456789"
      }
    }
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "tenantId": "507f1f77bcf86cd799439011",
    "apiKey": "ae_live_abcdef123456789",
    "name": "My Organization",
    "domain": "myorg.com"
  }
}
```

## Response Format

All responses follow this format:

### Success Response

```json
{
  "success": true,
  "data": {
    "key": "value"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| BAD_REQUEST | 400 | Invalid request parameters |
| UNAUTHORIZED | 401 | Missing or invalid API key |
| FORBIDDEN | 403 | Not authorized for this resource |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMIT | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
| DATABASE_ERROR | 500 | Database error |
| VALIDATION_ERROR | 400 | Request validation failed |
| PAYLOAD_TOO_LARGE | 413 | Request body over 1 MB |
| BATCH_TOO_LARGE | 400 | More than 50 events in one batch |
| INVALID_SIGNATURE | 403 | `x-signature` did not verify |
| MISSING_API_KEY | 401 | No `x-api-key` header |
| INVALID_API_KEY | 401 | Key is unknown or inactive |

Per-event codes returned inside `POST /events` results, not as an HTTP status:

| Code | Meaning |
|------|---------|
| INVALID_NAME | Event name failed `^[a-z][a-z0-9_]{0,63}$` |
| INVALID_TIMESTAMP | `occurredAt` is not a valid ISO-8601 date |
| TIMESTAMP_OUT_OF_RANGE | `occurredAt` more than ±24 h from server time |
| INVALID_VALUE / VALUE_OUT_OF_RANGE | `value` not finite, negative, or too large |
| INVALID_CURRENCY | Not a 3-letter ISO-4217 code |
| UNSIGNED_REVENUE | Monetary event sent at client trust while the tenant requires signing |
| EVENT_NAME_LIMIT | Tenant is at its distinct-name ceiling |
| WRITE_FAILED | Event could not be stored |

## Endpoints

### Public Endpoints (No Auth Required)

#### Resolve Link
```
GET /:shortCode
```

Resolves a short link and performs device-aware redirect. This is the main entry point for users clicking links.

**Response**: HTML page with client-side redirect logic

---

#### Collect Fingerprint
```
POST /fingerprint
```

Collects device fingerprint after failed app deep link attempt.

**Request Body**:
```json
{
  "linkId": "507f1f77bcf86cd799439011",
  "tenantId": "507f1f77bcf86cd799439012",
  "fingerprint": {
    "ipAddress": "203.0.113.42",
    "userAgent": "Mozilla/5.0...",
    "screen": {
      "width": 1920,
      "height": 1080
    },
    "language": "en-US",
    "timezone": "America/New_York",
    "platform": "MacIntel",
    "vendor": "Google Inc.",
    "touchSupport": false,
    "colorDepth": 24,
    "pixelRatio": 1
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "fingerprintId": "507f1f77bcf86cd799439013",
    "status": "pending"
  }
}
```

---

#### Match Deferred Link
```
POST /deferred/match
```

Called by app after fresh install to match against prior web clicks.

**Request Body**:
```json
{
  "tenantId": "507f1f77bcf86cd799439012",
  "fingerprint": {
    "ipAddress": "203.0.113.42",
    "userAgent": "Mozilla/5.0...",
    "screen": { "width": 1920, "height": 1080 },
    "language": "en-US",
    "timezone": "America/New_York",
    "platform": "MacIntel",
    "vendor": "Google Inc.",
    "touchSupport": false,
    "colorDepth": 24,
    "pixelRatio": 1
  }
}
```

**Response** (Match Found):
```json
{
  "success": true,
  "data": {
    "matched": true,
    "deferredLinkId": "507f1f77bcf86cd799439014",
    "linkId": "507f1f77bcf86cd799439011",
    "params": {
      "eventId": "evt_123",
      "action": "view_event",
      "utmSource": "instagram"
    },
    "destinationUrl": "https://allevents.in/events/123",
    "matchScore": 85
  }
}
```

**Response** (No Match):
```json
{
  "success": true,
  "data": {
    "matched": false,
    "deferredLinkId": null
  }
}
```

---

#### Confirm Deferred Link
```
POST /deferred/confirm
```

Confirms that the app received and opened the matched deferred link.

**Request Body**:
```json
{
  "deferredLinkId": "507f1f77bcf86cd799439014",
  "deviceId": "device_abc123xyz"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "confirmed": true,
    "deferredLinkId": "507f1f77bcf86cd799439014",
    "deviceId": "device_abc123xyz"
  }
}
```

---

#### Health Check
```
GET /health
```

Check service availability.

**Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-04-21T12:00:00Z",
    "database": "connected"
  }
}
```

---

### Authenticated Endpoints

All endpoints below require `X-API-Key` header.

#### Create Link
```
POST /links
```

Create a new short link.

**Request Body**:
```json
{
  "destinationUrl": "https://allevents.in/events/123",
  "linkType": "event",
  "campaignId": "507f1f77bcf86cd799439015",
  "params": {
    "eventId": "evt_123",
    "action": "view_event",
    "utmSource": "instagram",
    "utmMedium": "social",
    "couponCode": "SAVE20"
  },
  "platformOverrides": {
    "android": {
      "url": "allevents://event/123",
      "fallback": "https://play.google.com/store/apps/details?id=com.allevents.app"
    },
    "ios": {
      "url": "allevents://event/123",
      "fallback": "https://apps.apple.com/app/allevents/id123456789"
    }
  },
  "storeRedirect": { "mobile": true, "web": true },
  "shortCode": "custom_code",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

**`storeRedirect`** (object, both sides default `true`) — whether a click may end
at the app store, switched separately for phones (`mobile`, covering Android and
iOS) and desktop browsers (`web`). Set a side to `false` and a device *without
the app installed* opens the link's own web destination instead of the store.
The app is still tried first, so a device that has it installed opens natively
as usual.

Where the browser lands when the store is off, in priority order:

1. the `deepLink` query param of the click being served — a dynamic link points
   at a different page per click, so it wins over anything stored on the link;
2. the link's stored `destinationUrl`;
3. `platformOverrides.web.url` (the static web fallback).

If the link has none of the three, the click lands on the **app info page**
instead: the app's icon, tagline and description, its store badges, and — on
desktop — a QR code of this same short link, so scanning it carries the click's
deep link and UTMs across to the phone. Fill in `info` on the App
(Dashboard → Apps) to control that copy; it falls back to the app name and
store URLs when blank.

The app is always tried first, so a device that has it installed opens
natively even when the store is off — the app info page is only reached once
no app-open attempt is left to make.

A single click can override the stored setting without editing the link. The
override applies to whichever side is serving that click — a phone reads it
against `mobile`, a desktop browser against `web`:

| Query param | Effect |
| --- | --- |
| `?no_app_redirect=1` | store off for this click |
| `?storeRedirect=0` | store off for this click |
| `?storeRedirect=1` | store on, even if the link has it switched off |

### Query param spelling

Control params are matched on their letters alone, so casing and separators
never matter. `deepLink`, `deeplink`, `deep_link`, `deep-link` and `DEEP_LINK`
are all the same param, and the same holds for `no_app_redirect` and
`storeRedirect`. Only exact-word matches count — `deeplinks` or `mydeeplink`
are treated as ordinary custom params, not as the destination.

These params are also kept in `params.custom` so the bypass stays visible in
click analytics.

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "shortCode": "abc123",
    "destinationUrl": "https://allevents.in/events/123",
    "linkType": "event",
    "params": { ... },
    "clickCount": 0,
    "isActive": true,
    "createdAt": "2024-04-21T12:00:00Z"
  }
}
```

---

#### List Links
```
GET /links?limit=50&offset=0&campaignId=...
```

List all links for authenticated tenant.

**Query Parameters**:
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset (default: 0)
- `campaignId`: Filter by campaign (optional)

**Response**:
```json
{
  "success": true,
  "data": {
    "links": [...],
    "total": 256,
    "limit": 50,
    "offset": 0
  }
}
```

---

#### Get Link
```
GET /links/:id
```

Get a single link by ID.

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "shortCode": "abc123",
    ...
  }
}
```

---

#### Update Link
```
PUT /links/:id
```

Update a link.

**Request Body**:
```json
{
  "destinationUrl": "https://new.url",
  "params": { ... },
  "isActive": false,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

---

#### Delete Link
```
DELETE /links/:id
```

Delete a link.

**Response**:
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

---

#### Create Campaign
```
POST /campaigns
```

Create a campaign for organizing links.

**Request Body**:
```json
{
  "name": "Summer Promotion",
  "slug": "summer-2024",
  "description": "Q2 promotional campaign",
  "fallbackUrl": "https://allevents.in/browse",
  "startDate": "2024-05-01T00:00:00Z",
  "endDate": "2024-08-31T23:59:59Z",
  "metadata": {
    "budget": 5000,
    "manager": "john@allevents.in"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "_id": "507f1f77bcf86cd799439015",
    "name": "Summer Promotion",
    "slug": "summer-2024",
    "status": "active",
    ...
  }
}
```

---

#### List Campaigns
```
GET /campaigns?status=active&limit=50&offset=0
```

List campaigns.

**Query Parameters**:
- `status`: Filter by status (active, paused, archived)
- `limit`: Results per page
- `offset`: Pagination offset

---

#### Get Campaign
```
GET /campaigns/:id
```

Get campaign details.

---

#### Update Campaign
```
PUT /campaigns/:id
```

Update campaign.

**Request Body**:
```json
{
  "name": "New Name",
  "status": "paused",
  "endDate": "2024-09-30T23:59:59Z"
}
```

---

#### Delete Campaign
```
DELETE /campaigns/:id
```

Delete campaign.

---

#### Get Analytics Overview
```
GET /analytics/overview
```

Get dashboard summary for authenticated tenant.

**Response**:
```json
{
  "success": true,
  "data": {
    "totalClicks": 1542,
    "totalConversions": 234,
    "conversionRate": 15.18,
    "totalLinks": 45,
    "activeCampaigns": 3,
    "deferredLinksMatched": 67,
    "topLinks": [...],
    "topCampaigns": [...],
    "clicksTrend": [...]
  }
}
```

---

#### Get Link Analytics
```
GET /analytics/links/:id
```

Get detailed analytics for a link.

**Response**:
```json
{
  "success": true,
  "data": {
    "linkId": "507f1f77bcf86cd799439011",
    "shortCode": "abc123",
    "totalClicks": 342,
    "clicks": {
      "android": 156,
      "ios": 128,
      "web": 58,
      "other": 0
    },
    "devices": {
      "mobile": 284,
      "tablet": 32,
      "desktop": 26
    },
    "conversions": {
      "total": 52,
      "appOpen": 34,
      "registration": 10,
      "purchase": 8,
      "view": 0
    },
    "deferredMatches": 23,
    "deferredMatchRate": 6.73,
    "topCountries": [...],
    "topBrowsers": [...],
    "createdAt": "2024-04-15T10:00:00Z",
    "lastClicked": "2024-04-21T15:30:00Z"
  }
}
```

---

#### Get Campaign Analytics
```
GET /analytics/campaigns/:id
```

Get detailed analytics for a campaign.

---

#### Register Tenant
```
POST /tenants
```

Register a new organization.

**Request Body**:
```json
{
  "name": "My Organization",
  "domain": "myorg.com",
  "app": {
    "android": {
      "package": "com.allevents.app",
      "sha256": "...",
      "storeUrl": "https://play.google.com/store/apps/details?id=com.allevents.app"
    },
    "ios": {
      "bundleId": "com.allevents.app",
      "teamId": "ABCD1234",
      "appId": "com.allevents.app",
      "storeUrl": "https://apps.apple.com/app/allevents/id123456789"
    }
  },
  "settings": {
    "fingerprintTtlHours": 72,
    "matchThreshold": 70,
    "defaultFallbackUrl": "https://allevents.in"
  }
}
```

---

#### Get Tenant Info
```
GET /tenants
```

Get authenticated tenant's information.

---

## Event Tracking

Deep linking records that a link was clicked and an app installed. Event tracking
records what happened next, with the link and campaign that earned it resolved
once on write and stored on the row.

### Key types and trust

Two kinds of API key reach these endpoints, and they are not equally trusted:

| Key | Trust | Notes |
|-----|-------|-------|
| `app_…` | `client` | Ships inside your app binary — anyone who decompiles the app has it |
| `app_…` + valid `x-signature` | `server` | HMAC-SHA256 over `${timestamp}.${rawBody}` using the tenant secret |
| tenant key | `server` | Only ever lives on your backend |

Endpoints that name or enumerate an individual **refuse app keys** entirely:

| Endpoint | App key |
|----------|---------|
| `POST /events`, `/identify`, `/identify/logout` | allowed — this is the SDK's job |
| `GET /analytics/events` | allowed — aggregates only |
| `GET /analytics/users` | **403** — enumerates user ids and lifetime value |
| `GET /identity/:userId` | **403** — traits, email hash, full timeline |
| `DELETE /identity/:userId` | **403** — erasure |

---

#### Track Events (batch)
```
POST /events
```

**Request**
```json
{
  "events": [{
    "name": "ticket_purchase",
    "deviceId": "a3f...",
    "sessionId": "sess_...",
    "occurredAt": "2026-07-28T09:14:02Z",
    "value": 1250,
    "currency": "INR",
    "properties": { "event_id": "evt_991", "qty": 2 },
    "idempotencyKey": "c1f2...",
    "platform": "android",
    "clickId": "..."
  }]
}
```

**Response — `207 Multi-Status`** (`200` when nothing was rejected)
```json
{
  "success": true,
  "data": {
    "results": [
      { "index": 0, "accepted": true, "eventId": "...", "attribution": "install_match" }
    ],
    "accepted": 1,
    "rejected": 0,
    "duplicates": 0
  }
}
```

Results are **per event, in request order** — one malformed event never rejects the
batch. A client should drop what was accepted *or permanently rejected* and retry
only transient failures (`429`, `5xx`, timeout).

A replayed `idempotencyKey` returns `{"accepted": true, "duplicate": true}` — a
no-op, not an error. Accepted events may also carry `warnings` naming fields that
were dropped or coerced.

**Attribution values**: `explicit_click`, `install_match`, `last_touch`, `direct`,
`none`. `none` means organic — data, not a failure.

**Limits**

| Limit | Value |
|-------|-------|
| Events per batch | 50 |
| Request body | 1 MB |
| `properties` | 8 KB, 50 keys, depth 3, 500-char strings, 20-item arrays |
| `name` pattern | `^[a-z][a-z0-9_]{0,63}$` |
| `occurredAt` skew | ±24 h — **rejected**, not clamped |
| Distinct event names per tenant | 200 (configurable) |

`properties` keys shaped like personal data (email, phone, name, card, password)
are **dropped** and reported in `warnings`. Use `identify` traits instead.

Events store `country` and `city`, never the IP address.

---

#### Identify a User
```
POST /identify
```

```json
{
  "userId": "u_88213",
  "deviceId": "a3f...",
  "traits": { "plan": "pro", "city": "Ahmedabad" },
  "email": "user@example.com"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "userId": "u_88213",
    "epoch": 1,
    "isNewIdentity": true,
    "backfilledEvents": 12,
    "acquisition": {
      "linkId": "...", "campaignId": "...", "campaign": "diwali-2026",
      "source": "whatsapp", "medium": "social", "shortCode": "xGJEQJR",
      "model": "install_match"
    },
    "warnings": []
  }
}
```

Attaches a device to a person. Events tracked earlier on this device are
backfilled onto them, **bounded by the device's identity epoch** so a backfill can
never reach across a previous sign-out.

The first identify sets `acquisition` — the link and campaign that acquired this
person — permanently, across every device they later sign in on. Later sign-ins
never overwrite it.

Only trait keys on the tenant's allowlist are stored. `email` is stored as a
SHA-256 hash unless `settings.storePlaintextEmail` is enabled.

Identity resolution is server-side: the SDK sends a `userId` here and never
asserts one on a plain event.

---

#### Log Out a Device
```
POST /identify/logout
```

```json
{ "deviceId": "a3f..." }
```

Bumps the identity epoch and clears `userId`. It deliberately does **not** rotate
`deviceId` — that would sever install attribution and re-count the install.

---

#### Get User Detail
```
GET /identity/:userId
```

**Tenant key only.** Returns acquisition (with resolved link and campaign),
attached devices with their epochs, allowlisted traits, the email hash, and the
100 most recent events. This is the endpoint that makes a data-subject access
request answerable in minutes.

---

#### Erase a User
```
DELETE /identity/:userId
```

**Tenant key only.** Deletes the identity and anonymises their events in place —
`userId` and `deviceId` are unset, the rows stay. Aggregate counts and historical
reports do not change.

```json
{ "success": true, "data": { "userId": "u_88213", "identityDeleted": true, "eventsAnonymised": 412 } }
```

---

#### Event Definitions
```
GET   /events/definitions
PATCH /events/definitions
```

The tenant's event vocabulary. Names auto-register on first sight; this is for
curation — `label`, `description`, `category`, `isConversion`, `expectsValue`,
`status`.

```json
{ "name": "ticket_purchase", "label": "Ticket Purchase", "isConversion": true }
```

A conversion is a **label** over events, not a separate counter, so flipping
`isConversion` reclassifies history immediately and nothing double-counts.

`name` itself is not editable — it is the join key on every row ever recorded.

---

#### Event Analytics
```
GET /analytics/events?view=<view>&from=&to=
```

| `view` | Returns |
|--------|---------|
| `breakdown` | Per event name: count, unique devices, unique users, revenue |
| `campaigns` | Per campaign: events, conversions, unique users, revenue |
| `links` | Per link: same shape |
| `timeseries` | Daily counts and value |
| `funnel` | click → install → open → sign-in → conversion, with drop-off |
| `health` | Unattributed rate, identified rate, clock skew, name-budget usage |

Optional filters: `name`, `linkId`, `campaignId`, `userId`, `deviceId`,
`platform`, `conversionsOnly`. Window defaults to the last 30 days and may span
at most 400 days.

---

#### List Users
```
GET /analytics/users?campaignId=&linkId=&sort=recent|value|events&page=&limit=
```

**Tenant key only.** Users acquired by a campaign or link, with lifetime value.

---

#### Rollups (internal)
```
POST /internal/rollup
x-cron-secret: $CRON_SECRET
```

```json
{ "days": 2 }
```
or `{ "date": "2026-07-27" }` to recompute a single day.

Recomputes daily aggregates. Authenticated with a **shared secret, not an API
key** — no tenant should be able to trigger a platform-wide aggregation. An unset
`CRON_SECRET` fails closed with `503`.

Idempotent: a re-run recomputes a day rather than doubling it.

---

## Rate Limiting

- **Public endpoints**: 100 requests/minute per IP
- **Authenticated endpoints**: 1000 requests/minute per API key

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1713695400
```

## Examples

### cURL

```bash
# Create a link
curl -X POST https://ae-link.allevents.app/api/v1/links \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "destinationUrl": "https://allevents.in/events/123",
    "linkType": "event"
  }'

# Get analytics
curl -X GET https://ae-link.allevents.app/api/v1/analytics/overview \
  -H "X-API-Key: your_api_key"
```

### JavaScript/Node.js

```javascript
const response = await fetch('https://ae-link.allevents.app/api/v1/links', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key'
  },
  body: JSON.stringify({
    destinationUrl: 'https://allevents.in/events/123',
    linkType: 'event',
    params: {
      eventId: 'evt_123'
    }
  })
});

const { data } = await response.json();
console.log(`Short link: https://ae-link.allevents.app/${data.shortCode}`);
```

### Python

```python
import requests

response = requests.post(
    'https://ae-link.allevents.app/api/v1/links',
    headers={
        'X-API-Key': 'your_api_key'
    },
    json={
        'destinationUrl': 'https://allevents.in/events/123',
        'linkType': 'event'
    }
)

data = response.json()
print(f"Short link: https://ae-link.allevents.app/{data['data']['shortCode']}")
```

## Webhooks (Future)

Webhook support for conversion tracking and link events is planned for v2.0.

## Changelog

### v1.1.0 (2026-07-30)

- Event ingest: `POST /events` (batched, per-event results, idempotent)
- Identity: `POST /identify`, `POST /identify/logout`
- `GET` / `DELETE /identity/:userId` — user detail and erasure
- `GET` / `PATCH /events/definitions` — per-tenant event vocabulary
- `GET /analytics/events` — six reporting views including the completed funnel
- `GET /analytics/users` — users acquired per campaign or link
- `POST /internal/rollup` — daily pre-aggregation, cron-secret authenticated
- Trust levels on ingest, with optional HMAC signing for billable revenue
- Tenant settings: `attributionWindowDays`, `eventRetentionDays`,
  `allowedTraitKeys`, `storePlaintextEmail`, `maxEventNames`,
  `requireSignedRevenue`

### v1.0.0 (2024-04-21)

- Initial release
- Link management
- Deferred deep linking
- Analytics dashboard
- Fingerprint matching
