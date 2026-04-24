import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartLink | Deep Linking Platform',
  description: 'SmartLink by AllEvents — seamless deep linking, deferred attribution, and real-time analytics for your mobile app.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
