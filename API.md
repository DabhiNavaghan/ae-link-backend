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
  "shortCode": "custom_code",
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

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

### v1.0.0 (2024-04-21)

- Initial release
- Link management
- Deferred deep linking
- Analytics dashboard
- Fingerprint matching
