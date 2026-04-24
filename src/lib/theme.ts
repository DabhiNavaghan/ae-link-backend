/**
 * SmartLink Design Tokens
 *
 * Single source of truth for all design values.
 * Change colors here → globals.css picks them up → entire app updates.
 *
 * Architecture: theme.ts → globals.css (CSS vars) → Tailwind → components
 */

// ── Brand ──
export const BRAND = {
  name: 'SmartLink',
  tagline: 'Deep Linking Platform',
  company: 'AllEvents',
  logo: {
    text: 'SL',
    gradient: { from: '#6366f1', to: '#14b8a6' },
  },
} as const;

// ── Colors ──
// To rebrand: change these values, run the app, done.
export const COLORS = {
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  secondary: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
  },
  accent: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
  },
  success: {
    50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
  },
  warning: {
    50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
  },
  danger: {
    50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c',
  },
} as const;

// ── Dark / Light theme backgrounds ──
export const THEME = {
  light: {
    bg: '#f8fafc',
    bgCard: '#ffffff',
    bgSecondary: '#f1f5f9',
    text: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#94a3b8',
    border: '#e2e8f0',
    borderHover: '#cbd5e1',
  },
  dark: {
    bg: '#0f172a',
    bgCard: '#1e293b',
    bgSecondary: '#1e293b',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    border: '#334155',
    borderHover: '#475569',
  },
} as const;

// ── Typography ──
export const FONTS = {
  heading: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  body: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
} as const;

// ── Spacing / Radius ──
export const RADIUS = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  full: '9999px',
} as const;

// ── Shadows ──
export const SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
} as const;

// ── Navigation items (single source for sidebar + mobile) ──
export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'home' },
  { label: 'Apps', href: '/dashboard/apps', icon: 'apps' },
  { label: 'Campaigns', href: '/dashboard/campaigns', icon: 'campaigns' },
  { label: 'Links', href: '/dashboard/links', icon: 'links' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: 'analytics' },
  { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
] as const;

// ── API & Storage keys ──
export const STORAGE_KEYS = {
  apiKey: 'smartlink-api-key',
  theme: 'smartlink-theme',
  sidebarCollapsed: 'smartlink-sidebar-collapsed',
} as const;

// ── App metadata ──
export const APP_META = {
  title: 'SmartLink',
  description: 'Deep linking platform for seamless app attribution',
  url: 'https://aelink.vercel.app',
} as const;
