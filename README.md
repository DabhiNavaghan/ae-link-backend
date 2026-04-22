# AE-LINK Backend

Production-grade deferred deep linking platform for AllEvents, built with Next.js 14, TypeScript, MongoDB, and Mongoose.

## Overview

AE-LINK enables seamless deep linking with intelligent device fingerprinting and deferred matching. When users click a short link from a browser, the system collects device fingerprints and intelligently matches them when the app is installed later.

## Key Features

- **Smart Deep Linking**: Automatically routes users to the appropriate platform (app, web, or store)
- **Deferred Deep Linking**: Matches app installs to prior clicks using device fingerprinting
- **Campaign Tracking**: Built-in campaign management and attribution
- **Analytics Dashboard**: Real-time insights into link performance, conversions, and traffic
- **Multi-Tenant**: Support for multiple organizations with isolated data
- **Device Detection**: Automatic OS, browser, and device type detection
- **Rate Limiting**: Built-in rate limiting for API endpoints
- **Vercel Ready**: Optimized for serverless deployment on Vercel

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **MongoDB + Mongoose** for persistent storage
- **UA Parser** for device detection
- **Vercel** for deployment

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Vercel account for deployment

### Installation

```bash
# Clone and install
npm install

# Copy environment variables
cp .env.example .env.local

# Update .env.local with your MongoDB URI and settings
```

### Development

```bash
npm run dev
# Server runs on http://localhost:3000
```

### Build & Deploy

```bash
npm run build
npm start

# Or deploy to Vercel:
vercel deploy
```

## API Endpoints

### Public Endpoints (No Auth Required)

#### Resolve Short Link
```
GET /:shortCode
```
SSR page that resolves the link and performs device-aware redirect.

#### Collect Fingerprint
```
POST /api/v1/fingerprint
Body: { linkId, ipAddress, userAgent, fingerprint: {...} }
```

#### Match Deferred Link
```
POST /api/v1/deferred/match
Body: { tenantId, fingerprint: {...} }
Response: { deferredLinkId, linkId, params, destinationUrl, matchScore }
```

#### Confirm Deferred Link
```
POST /api/v1/deferred/confirm
Body: { deferredLinkId, deviceId }
```

#### Health Check
```
GET /api/health
```

### Authenticated Endpoints (API Key Required)

All authenticated endpoints require:
- Header: `X-API-Key: {api_key}`
- For sensitive ops: `X-Signature: {hmac_signature}`

#### Links

```
GET    /api/v1/links                    # List links
POST   /api/v1/links                    # Create link
GET    /api/v1/links/:id                # Get single link
PUT    /api/v1/links/:id                # Update link
DELETE /api/v1/links/:id                # Delete link
```

#### Campaigns

```
GET    /api/v1/campaigns                # List campaigns
POST   /api/v1/campaigns                # Create campaign
GET    /api/v1/campaigns/:id            # Get single campaign
PUT    /api/v1/campaigns/:id            # Update campaign
DELETE /api/v1/campaigns/:id            # Delete campaign
```

#### Analytics

```
GET /api/v1/analytics/overview          # Dashboard stats
GET /api/v1/analytics/links/:linkId     # Link analytics
GET /api/v1/analytics/campaigns/:campaignId  # Campaign analytics
```

#### Tenant Management

```
POST /api/v1/tenants                    # Register tenant
GET  /api/v1/tenants                    # Get tenant info
```

## Database Schema

### Tenant
Represents an organization/account using the platform.

### Campaign
Logical grouping of links for tracking and organization.

### Link
A short link that redirects with device awareness.

### Click
Records each time a link is clicked, including device/geo data.

### Fingerprint
Device fingerprint data collected from web visitors.

### DeferredLink
Represents a link that was clicked before app install, awaiting match.

### Conversion
Tracks conversions: app opens, registrations, purchases, etc.

## Architecture Highlights

### Link Resolution Flow
1. User clicks short link → GET /:shortCode
2. Server detects device from UA and IP
3. Records click event
4. Renders RedirectPage component
5. Component attempts app deep link (mobile) or direct redirect (desktop)
6. If app not installed → collects fingerprint → redirects to store
7. If desktop → redirects to web destination

### Deferred Matching Flow
1. User installs app after clicking link
2. App calls POST /api/v1/deferred/match with device fingerprint
3. Service finds best matching fingerprint using scoring algorithm
4. Returns matched link params (event_id, action, UTMs, etc.)
5. App confirms match with POST /api/v1/deferred/confirm
6. System tracks as successful deferred link

### Fingerprint Scoring Algorithm
- IP match: 40 points
- User agent hash: 30 points
- Screen resolution: 10 points
- Language: 5 points
- Timezone: 5 points
- Time proximity: up to 10 points
- **Threshold: 70+ points for match**

## Deployment

### Vercel Deployment

1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard:
   - MONGODB_URI
   - NODE_ENV=production
3. Deploy: `vercel deploy --prod`

### Environment Variables

See `.env.example` for complete list. Critical variables:

- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: production/development
- `NEXT_PUBLIC_APP_URL`: Your app's public URL
- `ALLOWED_ORIGINS`: CORS-allowed origins

## Performance Considerations

- **MongoDB Connection Pooling**: Single connection instance cached in serverless
- **Rate Limiting**: In-memory Map-based limiter (100 req/min public, 1000 req/min auth)
- **TTL Indexes**: Automatic cleanup of expired fingerprints and deferred links
- **Aggregation Pipeline**: MongoDB aggregation for efficient analytics
- **Short Code Index**: Unique index on shortCode for fast resolution

## Security

- API key authentication for management endpoints
- HMAC-SHA256 signature verification for sensitive operations
- CORS middleware for cross-origin requests
- Rate limiting on public endpoints
- Input validation on all requests
- Mongoose schema validation

## Monitoring

- Structured logging with Pino
- Log levels: debug, info, warn, error
- Analytics tracking for all link clicks and conversions
- Click/conversion rate monitoring

## Troubleshooting

### MongoDB Connection Issues
- Verify MONGODB_URI in .env.local
- Check MongoDB Atlas IP whitelist
- Ensure network connectivity

### Short Link Not Resolving
- Check shortCode exists in database
- Verify link is active (isActive: true)
- Check expiration date

### Fingerprint Not Matching
- Ensure fingerprint is sent within TTL window (default 72h)
- Check matching score with matchDetails in DeferredLink

## License

Proprietary - AllEvents 2024
