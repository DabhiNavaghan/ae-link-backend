# AE-LINK Dashboard - Quick Start Guide

## Installation

```bash
npm install
npm run dev
```

Navigate to `http://localhost:3000/dashboard`

## Using Components

### Import Individual Components

```tsx
import { Button, Input, Badge, Modal } from '@/components/ui';

export default function MyPage() {
  return (
    <div>
      <Button variant="primary">Click Me</Button>
      <Input label="Email" type="email" />
      <Badge status="active">Active</Badge>
    </div>
  );
}
```

### Using Data Table

```tsx
import { DataTable } from '@/components/ui';

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'status', label: 'Status' },
  { key: 'clicks', label: 'Clicks' },
];

<DataTable
  columns={columns}
  data={items}
  isLoading={loading}
  actions={[
    { label: 'Edit', onClick: handleEdit },
  ]}
/>
```

### Using Charts

```tsx
import { LineChart, BarChart, DonutChart } from '@/components/ui';

<LineChart
  title="Clicks Over Time"
  data={[
    { label: 'Mon', value: 100 },
    { label: 'Tue', value: 150 },
  ]}
  color="primary"
  animated
/>
```

### Using Modals

```tsx
import { Modal } from '@/components/ui';
import { useState } from 'react';

export default function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open</button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Confirm Action"
        footer={
          <>
            <button onClick={() => setIsOpen(false)}>Cancel</button>
            <button onClick={handleConfirm}>Confirm</button>
          </>
        }
      >
        Are you sure?
      </Modal>
    </>
  );
}
```

### Using Toast Notifications

```tsx
import { useToast } from '@/components/ui';

export default function MyComponent() {
  const { addToast } = useToast();

  const handleAction = async () => {
    try {
      await doSomething();
      addToast('success', 'Action completed!');
    } catch (error) {
      addToast('error', 'Action failed');
    }
  };

  return <button onClick={handleAction}>Do Something</button>;
}
```

## Using API Hooks

### Fetch Campaigns

```tsx
import { useCampaigns } from '@/lib/hooks/useApi';

export default function CampaignsPage() {
  const { campaigns, isLoading, error, fetchCampaigns } = useCampaigns();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {campaigns.map(c => (
        <li key={c.id}>{c.name}</li>
      ))}
    </ul>
  );
}
```

### Create Campaign

```tsx
import { useCampaigns } from '@/lib/hooks/useApi';
import { useToast } from '@/components/ui';

export default function CreateCampaign() {
  const { createCampaign } = useCampaigns();
  const { addToast } = useToast();

  const handleCreate = async (name: string) => {
    try {
      await createCampaign({
        name,
        status: 'active',
      });
      addToast('success', 'Campaign created!');
    } catch (error) {
      addToast('error', 'Failed to create campaign');
    }
  };

  return <form onSubmit={(e) => {
    e.preventDefault();
    handleCreate(e.target.name.value);
  }}>
    <input name="name" required />
    <button type="submit">Create</button>
  </form>;
}
```

### Fetch Analytics

```tsx
import { useAnalytics } from '@/lib/hooks/useApi';

export default function AnalyticsDashboard() {
  const { analytics, isLoading, fetchAnalytics } = useAnalytics();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Total Clicks: {analytics?.totalClicks}</h2>
      <h2>Conversions: {analytics?.totalConversions}</h2>
      <h2>Rate: {analytics?.conversionRate}%</h2>
    </div>
  );
}
```

## File Structure Quick Reference

```
src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx          # Sidebar + Header
│   │   └── page.tsx            # Home
│   └── globals.css             # Global styles
├── components/ui/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Modal.tsx
│   ├── DataTable.tsx
│   ├── Chart.tsx
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   ├── Toast.tsx
│   └── index.ts                # Exports all
├── lib/
│   ├── context/
│   │   └── DashboardContext.tsx
│   └── hooks/
│       └── useApi.ts
└── types/
    └── index.ts
```

## Color Usage

```tsx
// Primary: Soft Indigo
className="bg-primary-600 text-primary-600"

// Secondary: Soft Teal
className="bg-secondary-600 text-secondary-600"

// Accent: Warm Orange
className="bg-accent-600 text-accent-600"

// Status Colors
className="bg-success-600"    // Green
className="bg-warning-600"    // Amber
className="bg-danger-600"     // Red

// Text
className="text-slate-900"    // Dark
className="text-slate-600"    // Medium
className="text-slate-400"    // Light
```

## Styling Quick Tips

### Cards
```tsx
<div className="card p-6">Content</div>
<div className="card-lg p-6">Large card</div>
```

### Buttons
```tsx
<Button variant="primary" size="md">Primary</Button>
<Button variant="secondary" size="sm">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger" size="lg">Delete</Button>
```

### Grid Layouts
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Cards go here */}
</div>
```

### Spacing Shortcuts
- `p-6` = padding 24px
- `gap-6` = gap 24px
- `mb-4` = margin-bottom 16px

### Transitions
```tsx
<div className="transition-all duration-200 hover:shadow-md">
  Hover effect
</div>
```

## Common Patterns

### Loading States
```tsx
<Button isLoading={isLoading} disabled={isLoading}>
  Create
</Button>
```

### Error Handling
```tsx
const { error } = useCampaigns();

{error && (
  <div className="bg-danger-50 text-danger-800 p-4 rounded-lg">
    {error.message}
  </div>
)}
```

### Responsive Images
```tsx
<div className="flex items-center gap-3">
  <div className="w-8 h-8 bg-primary-600 rounded-lg" />
  <span>Text</span>
</div>
```

## API Key Management

Set API key from environment or localStorage:
```tsx
import { useDashboard } from '@/lib/context/DashboardContext';

const { setApiKey } = useDashboard();

// Set from environment
setApiKey(process.env.NEXT_PUBLIC_API_KEY);

// Or from user input
setApiKey(userInput);
```

## Deployment

```bash
npm run build
npm start
```

Environment variables in `.env.local`:
```
NEXT_PUBLIC_API_KEY=your_api_key
```

## Common Issues

### Tailwind not working
- Run `npm install`
- Restart dev server
- Check globals.css is imported in root layout

### API calls failing
- Verify API key is set in DashboardContext
- Check network tab for 401/403 errors
- Ensure X-API-Key header is being sent

### Components not importing
- Use `@/components/ui` path (not relative)
- Check component is exported from index.ts
- Ensure 'use client' directive if using hooks
