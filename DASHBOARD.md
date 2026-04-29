# AE-LINK Admin Dashboard

A modern, production-grade admin dashboard built with Next.js 14, React, and Tailwind CSS. Designed with a clean, professional aesthetic inspired by Branch.io and AppsFlyer.

## Overview

The dashboard provides a comprehensive interface for managing deep links, campaigns, and analytics with a soft color palette and intuitive user experience.

## Setup

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

This will install Tailwind CSS, PostCSS, and Autoprefixer alongside other dependencies.

### 2. Configuration Files

The following configuration files are already set up:

- **tailwind.config.ts** - Custom Tailwind theme with soft colors and extended utilities
- **postcss.config.js** - PostCSS configuration for Tailwind processing
- **src/app/globals.css** - Global styles and Tailwind imports

### 3. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Navigate to `http://localhost:3000/dashboard` to access the dashboard.

## Architecture

### Directory Structure

```
src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard layout with sidebar & header
│   │   ├── page.tsx            # Dashboard home page
│   │   ├── apps/               # Apps management section
│   │   ├── campaigns/          # Campaigns management section
│   │   ├── links/              # Links management section
│   │   ├── analytics/          # Analytics & reporting section
│   │   └── settings/           # Settings section
│   ├── globals.css             # Global styles
│   └── layout.tsx              # Root layout
├── components/
│   └── ui/
│       ├── Button.tsx          # Button component with variants
│       ├── Input.tsx           # Input component with validation
│       ├── Badge.tsx           # Status badges
│       ├── StatusDot.tsx       # Status indicator dots
│       ├── Modal.tsx           # Dialog/modal component
│       ├── Skeleton.tsx        # Loading skeleton components
│       ├── StatsCard.tsx       # Stat card with animations
│       ├── EmptyState.tsx      # Empty state component
│       ├── CopyButton.tsx      # Copy-to-clipboard button
│       ├── Toast.tsx           # Toast notification system
│       ├── Breadcrumb.tsx      # Navigation breadcrumbs
│       ├── DataTable.tsx       # Reusable data table
│       ├── Chart.tsx           # Chart components (Line, Bar, Donut)
│       ├── Header.tsx          # Top header bar
│       ├── Sidebar.tsx         # Collapsible sidebar navigation
│       └── index.ts            # Component exports
├── lib/
│   ├── context/
│   │   └── DashboardContext.tsx # Dashboard state management
│   └── hooks/
│       └── useApi.ts           # API hooks (useTenant, useCampaigns, etc.)
└── types/
    └── index.ts                # TypeScript type definitions
```

## Components

### UI Components

All UI components are built with pure Tailwind CSS (no external libraries like shadcn/ui or Material-UI).

#### Button Component
```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" isLoading={false}>
  Click me
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
- `size`: 'sm' | 'md' | 'lg'
- `isLoading`: boolean
- `fullWidth`: boolean
- `disabled`: boolean
- `children`: React.ReactNode

#### Input Component
```tsx
import { Input } from '@/components/ui';

<Input
  label="Email"
  type="email"
  placeholder="user@example.com"
  error={errors.email}
  helperText="We'll never share your email."
/>
```

#### Badge Component
```tsx
import { Badge } from '@/components/ui';

<Badge status="active">Active</Badge>
<Badge status="paused">Paused</Badge>
<Badge status="archived">Archived</Badge>
<Badge status="error">Error</Badge>
```

#### Modal Component
```tsx
import { Modal } from '@/components/ui';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  footer={
    <>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button variant="danger" onClick={handleConfirm}>
        Delete
      </Button>
    </>
  }
>
  Are you sure you want to delete this item?
</Modal>
```

#### DataTable Component
```tsx
import { DataTable } from '@/components/ui';

<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status' },
    {
      key: 'clicks',
      label: 'Clicks',
      render: (value) => value.toLocaleString(),
    },
  ]}
  data={items}
  isLoading={loading}
  onRowClick={handleRowClick}
  actions={[
    { label: 'Edit', onClick: handleEdit, icon: <EditIcon /> },
    { label: 'Delete', onClick: handleDelete, icon: <TrashIcon /> },
  ]}
  pagination={{
    currentPage: page,
    totalPages: totalPages,
    onPageChange: setPage,
  }}
/>
```

#### Chart Components
```tsx
import { LineChart, BarChart, DonutChart } from '@/components/ui';

// Line Chart
<LineChart
  title="Clicks Over Time"
  data={[
    { label: 'Mon', value: 2400 },
    { label: 'Tue', value: 1398 },
  ]}
  height={300}
  color="primary"
  animated
/>

// Bar Chart
<BarChart
  title="Top Links"
  data={[
    { label: 'Link 1', value: 4200 },
    { label: 'Link 2', value: 3200 },
  ]}
/>

// Donut Chart
<DonutChart
  title="Traffic by Platform"
  data={[
    { label: 'Mobile', value: 6500 },
    { label: 'Web', value: 3200 },
  ]}
  size="md"
/>
```

#### Toast Notification System
```tsx
import { useToast } from '@/components/ui';

const { addToast } = useToast();

// Usage
addToast('success', 'Link created successfully!', 3000);
addToast('error', 'Failed to create link', 3000);
addToast('warning', 'This action is not reversible', 3000);
addToast('info', 'New update available', 0); // No auto-dismiss
```

### API Hooks

Custom hooks for API interactions with caching support.

#### useApi Hook
```tsx
import { useApi } from '@/lib/hooks/useApi';

const { apiCall } = useApi();

const data = await apiCall('/campaigns', {
  method: 'GET',
  headers: { 'Custom-Header': 'value' },
});
```

#### useCampaigns Hook
```tsx
import { useCampaigns } from '@/lib/hooks/useApi';

const {
  campaigns,
  isLoading,
  error,
  fetchCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  refetch,
} = useCampaigns();

// Fetch campaigns
await fetchCampaigns();

// Create new campaign
await createCampaign({
  name: 'Q1 Campaign',
  status: 'active',
});

// Update campaign
await updateCampaign(campaignId, { status: 'paused' });

// Delete campaign
await deleteCampaign(campaignId);
```

#### useLinks Hook
```tsx
import { useLinks } from '@/lib/hooks/useApi';

const {
  links,
  isLoading,
  error,
  fetchLinks,
  createLink,
  updateLink,
  deleteLink,
  refetch,
} = useLinks();
```

#### useAnalytics Hook
```tsx
import { useAnalytics } from '@/lib/hooks/useApi';

const { analytics, isLoading, error, fetchAnalytics, refetch } = useAnalytics();
```

#### useTenant Hook
```tsx
import { useTenant } from '@/lib/hooks/useApi';

const { tenant, isLoading, error, fetchTenant, updateTenant } = useTenant();
```

### Dashboard Context

Global state management for tenant info and API configuration.

```tsx
import { useDashboard } from '@/lib/context/DashboardContext';

const { tenant, setTenant, apiKey, setApiKey, isLoading, setIsLoading } =
  useDashboard();

// Set API key (stored in localStorage)
setApiKey('your-api-key');

// Set tenant info
setTenant({
  id: '123',
  name: 'My Company',
  email: 'admin@example.com',
  apiKey: 'key-123',
});
```

## Color Palette

### Primary Colors
- **Soft Indigo**: #6366F1 (primary-600)
  - Used for primary actions, active states, primary charts
  - Light: #EEF2FF, Dark: #3730A3

### Secondary Colors
- **Soft Teal**: #14B8A6 (secondary-600)
  - Used for secondary actions, secondary charts
  - Light: #F0FDFA, Dark: #115E59

### Accent Colors
- **Warm Orange**: #F97316 (accent-500)
  - Used for AllEvents branding, highlights, CTAs
  - Light: #FFF7ED, Dark: #9A3412

### Status Colors
- **Success**: #22C55E (green-600)
- **Warning**: #F59E0B (amber-600)
- **Danger**: #EF4444 (red-600)
- **Info/Primary**: #6366F1 (indigo-600)

### Neutral Colors
- **Light Gray**: #F8FAFC (slate-50) - Page background
- **Card White**: #FFFFFF - Card backgrounds
- **Text Dark**: #0F172A (slate-900) - Primary text
- **Text Gray**: #475569 (slate-600) - Secondary text

## Styling Guidelines

### Spacing
- Use 6px increments: 4px, 6px, 12px, 16px, 24px, 32px, 48px, 64px
- Card padding: 24px (p-6)
- Section spacing: 24px gap (gap-6)
- Container max-width: 1280px (max-w-7xl)

### Typography
- System font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, etc.
- Headings: bold, slate-900
- Body text: slate-600, 16px line-height
- Small text: 14px, slate-500

### Shadows
- `shadow-sm`: Subtle cards
- `shadow-md`: Elevated cards
- `shadow-lg`: Modals, dropdowns
- `shadow-xl`: High-priority modals

### Rounded Corners
- Small: 6px (rounded-lg)
- Medium: 8px (rounded-xl)
- Large: 12px (rounded-2xl)

### Transitions
- Default: 200ms (duration-200)
- Animations: ease-in-out timing function
- Hover effects on buttons and cards
- Smooth color transitions

## Best Practices

1. **Use Component Composition**
   - Build pages from reusable components
   - Pass data and handlers through props

2. **Error Handling**
   - Use toast notifications for user feedback
   - Handle API errors gracefully
   - Show empty states when appropriate

3. **Loading States**
   - Use skeleton loaders for tables and cards
   - Disable buttons during API calls
   - Show loading spinners on inputs

4. **Accessibility**
   - Use semantic HTML
   - Include aria-labels on icon buttons
   - Keyboard navigation support
   - Color contrast ratio > 4.5:1

5. **Performance**
   - Implement caching in API hooks
   - Use lazy loading for charts
   - Pagination for large datasets
   - Memoization for expensive components

## Building Sections

### Dashboard Home
```
src/app/dashboard/page.tsx
- Stats cards with real data
- Charts showing trends
- Recent activity/quick actions
```

### Apps Management
```
src/app/dashboard/apps/page.tsx
- List of apps
- Create/edit/delete apps
- App settings
```

### Campaigns
```
src/app/dashboard/campaigns/page.tsx
- Campaign list with filters
- Campaign creation wizard
- Campaign analytics
```

### Links
```
src/app/dashboard/links/page.tsx
- Link management table
- Link builder/editor
- Link preview
```

### Analytics
```
src/app/dashboard/analytics/page.tsx
- Detailed analytics charts
- Conversion funnels
- Custom date ranges
```

### Settings
```
src/app/dashboard/settings/page.tsx
- Account settings
- API key management
- Team management
- Integrations
```

## Deployment

1. Install dependencies: `npm install`
2. Build: `npm run build`
3. Start: `npm start`
4. Set environment variables in `.env.local`

## Documentation

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [React Hooks](https://react.dev/reference/react)

## Support

For issues or questions, refer to the API documentation in `API.md`.
