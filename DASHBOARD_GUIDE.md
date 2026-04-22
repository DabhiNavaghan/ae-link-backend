# AE-LINK Dashboard Implementation Guide

This document describes the complete implementation of the AE-LINK admin dashboard with Home, Apps Management, and Setup pages.

## Overview

The dashboard is a modern, fully-featured admin panel built with Next.js 14, React 18, and Tailwind CSS. It provides a Branch.io-style interface for managing deep links, campaigns, analytics, and app configurations.

### Design System

- **Primary Color:** Soft Indigo (#4F46E5)
- **Secondary Color:** Teal (#0D9488)
- **Accent Color:** Warm Coral (#FF6B35)
- **Typography:** Inter font family
- **Components:** Custom Tailwind CSS classes, no external UI libraries
- **Responsive:** Mobile-first, fully responsive design

## Files Created

### 1. API Client (`src/lib/api.ts`)

A centralized API client for all dashboard API calls.

**Key Features:**
- Singleton pattern for consistent API key management
- Automatic localStorage persistence of API key
- Type-safe request/response handling
- Support for all CRUD operations on tenants, campaigns, links
- Analytics endpoints for dashboard data

**Usage:**
```typescript
import { aeLinkApi } from '@/lib/api';

// Set API key
aeLinkApi.setApiKey('your-api-key');

// Fetch overview
const overview = await aeLinkApi.getOverview();

// Create a campaign
const campaign = await aeLinkApi.createCampaign({
  name: 'Summer Sale',
  slug: 'summer-sale',
});
```

### 2. Dashboard Home Page (`src/app/dashboard/page.tsx`)

The main dashboard overview showing key metrics and performance data.

**Components:**
- **Stat Cards** (4 columns): Total Clicks, Conversions, Conversion Rate, Active Links
- **Charts Section** (2 columns):
  - Clicks Trend: 30-day line chart with animated bars
  - Platform Breakdown: Donut chart showing Android/iOS/Web distribution
- **Top Links Table**: 10 most clicked links with conversions and rates
- **Top Campaigns Table**: 5 best performing campaigns
- **Quick Actions Panel**: Buttons to create links, campaigns, and apps

**Features:**
- Real-time data fetching from `/api/v1/analytics/overview`
- Loading skeletons while data is being fetched
- Error handling with fallback UI
- Animated stat cards and charts
- Responsive layout that works on mobile, tablet, and desktop

### 3. Apps Management Page (`src/app/dashboard/apps/page.tsx`)

Manage registered apps and their configurations.

**Components:**
- **App List**: Card-based grid layout showing registered apps
- **App Card**: Displays app name, domain, Android/iOS configs, API key (masked with reveal toggle), and status badge
- **Add App Modal**: Form for registering a new app

**Features:**
- Fetches current tenant info from `/api/v1/tenants`
- Modal form for adding new apps
- API key visibility toggle
- Copy-to-clipboard functionality for API keys
- Support for Android and iOS configuration
- Settings management (fingerprint TTL, match threshold, fallback URL)

**Form Sections:**
- Basic Information (Name, Domain)
- Android Configuration (Package, SHA256, Store URL)
- iOS Configuration (Bundle ID, Team ID, App ID, Store URL)
- Settings (TTL, Threshold, Fallback URL)

### 4. App Detail Page (`src/app/dashboard/apps/[id]/page.tsx`)

View and manage a specific app's configuration.

**Sections:**
- App overview with status
- Stats row showing total links, clicks, conversions
- API Configuration (key reveal, copy, regenerate)
- Platform Configuration (Android and iOS details)
- Integration Guide (Flutter SDK code snippet)
- Settings Display (TTL, threshold, fallback URL)

**Features:**
- Dynamic routing with app ID parameter
- Copy-to-clipboard for API key
- Reveal/hide toggle for sensitive data
- Integration guide with ready-to-use code
- Error handling for missing apps

### 5. Setup/Onboarding Page (`src/app/dashboard/setup/page.tsx`)

First-time setup wizard for new users.

**Steps:**
1. **API Key Step**: Enter existing API key or create new app
2. **App Details Step**: App name, domain, fallback URL
3. **Platforms Step**: Android and iOS configuration
4. **Success Step**: Display generated API key with copy button

**Features:**
- Progress indicator showing step 1-3
- Animated transitions between steps
- Form validation
- API key generation and display
- Instructions for next steps after setup
- Beautiful gradient background with centered card design

## Architecture

### Component Structure

```
src/
├── lib/
│   └── api.ts                      # Centralized API client
├── components/
│   └── ui/                         # Reusable UI components
│       ├── Button.tsx
│       ├── Badge.tsx
│       └── Input.tsx
└── app/
    └── dashboard/
        ├── page.tsx                # Dashboard home
        ├── layout.tsx              # Dashboard layout (sidebar, nav)
        ├── setup/page.tsx          # Onboarding wizard
        ├── apps/
        │   ├── page.tsx            # Apps list
        │   └── [id]/page.tsx       # App details
        ├── campaigns/              # Campaign pages (separate agent)
        ├── links/                  # Link pages (separate agent)
        ├── analytics/              # Analytics pages (separate agent)
        └── settings/               # Settings (separate agent)
```

### Data Flow

1. **Client Component** renders and calls API
2. **aeLinkApi** client makes fetch request with stored API key
3. **API Endpoint** authenticates and returns data
4. **Component** updates state and re-renders
5. **UI** displays data with loading states, errors, and empty states

## Key Features

### 1. API Key Management
- Stored in localStorage for persistent authentication
- Can be set/cleared/retrieved
- Masked display with reveal toggle
- Copy-to-clipboard functionality

### 2. Type Safety
- Full TypeScript support
- Interfaces for all API responses
- Generic request handler with type inference

### 3. Error Handling
- User-friendly error messages
- Network error detection
- 401 Unauthorized handling (redirects to setup)
- Loading states for better UX

### 4. Responsive Design
- Mobile-first approach
- Tailwind CSS utilities
- Flexible grid layouts
- Touch-friendly buttons and forms

### 5. Visual Feedback
- Loading skeletons
- Animated transitions
- Success/error messages
- Copy button feedback

## API Integration

The dashboard connects to these endpoints:

```
POST   /api/v1/tenants              # Register new app
GET    /api/v1/tenants              # Get current tenant
PUT    /api/v1/tenants/:id          # Update tenant

GET    /api/v1/analytics/overview   # Dashboard overview
GET    /api/v1/analytics/links/:id  # Link analytics
GET    /api/v1/analytics/campaigns/:id # Campaign analytics

GET    /api/v1/campaigns            # List campaigns
POST   /api/v1/campaigns            # Create campaign
GET    /api/v1/campaigns/:id        # Get campaign
PUT    /api/v1/campaigns/:id        # Update campaign
DELETE /api/v1/campaigns/:id        # Delete campaign

GET    /api/v1/links                # List links
POST   /api/v1/links                # Create link
GET    /api/v1/links/:id            # Get link
PUT    /api/v1/links/:id            # Update link
DELETE /api/v1/links/:id            # Delete link
```

## Styling

All styling uses Tailwind CSS classes defined in `tailwind.config.ts` and `globals.css`.

### Color Palette
- Primary: Soft Indigo (customizable)
- Secondary: Teal
- Accent: Coral
- Grays: Slate 50-900
- Status: Green (success), Red (danger), Yellow (warning), Gray (archived)

### Component Classes
- `.card`: White rounded card with shadow
- `.btn-base`: Button base styles
- `.badge-base`: Badge base styles
- `.input-base`: Input base styles
- `.table-base`: Table base styles

## Usage Examples

### Fetch Dashboard Overview
```typescript
const overview = await aeLinkApi.getOverview();
console.log(`Total clicks: ${overview.totalClicks}`);
console.log(`Conversion rate: ${overview.conversionRate}%`);
```

### Create New App
```typescript
const tenant = await aeLinkApi.registerTenant({
  name: 'My App',
  domain: 'myapp.com',
  app: {
    android: {
      package: 'com.myapp',
      sha256: '...',
      storeUrl: 'https://...',
    },
    ios: {
      bundleId: 'com.myapp',
      teamId: 'ABC123',
      appId: '...',
      storeUrl: 'https://...',
    },
  },
});
```

### Get Current Tenant
```typescript
const tenant = await aeLinkApi.getTenant();
console.log(`App: ${tenant.name}`);
console.log(`Domain: ${tenant.domain}`);
```

## Future Enhancements

1. **Edit App**: Update existing app configuration
2. **Delete App**: Remove apps with confirmation
3. **Regenerate API Key**: Create new API key with old key invalidation
4. **Export Analytics**: Download analytics data as CSV/PDF
5. **Webhooks**: Configure webhooks for conversion events
6. **Team Management**: Multi-user support with roles
7. **Advanced Filtering**: Filter links and campaigns by status, date range
8. **Real-time Updates**: WebSocket support for live analytics

## Troubleshooting

### API Key Not Persisting
- Check browser localStorage is enabled
- Verify API key format is correct

### Cannot Load Dashboard
- Check API key is set (visit /dashboard/setup)
- Verify API endpoints are accessible
- Check browser console for error messages

### Forms Not Submitting
- Verify all required fields are filled
- Check for network errors in browser console
- Ensure API is responding correctly

## Testing the Dashboard

1. **Setup**: Navigate to `/dashboard/setup`
2. **Register App**: Fill out the form with test data
3. **View Dashboard**: Navigate to `/dashboard`
4. **Create Links**: Use quick actions to create test links
5. **Check Analytics**: Verify stats are displaying correctly

## Related Files

- Dashboard Layout: `src/app/dashboard/layout.tsx`
- Types: `src/types/index.ts`
- UI Components: `src/components/ui/`
- Tailwind Config: `tailwind.config.ts`
- Global Styles: `src/app/globals.css`

