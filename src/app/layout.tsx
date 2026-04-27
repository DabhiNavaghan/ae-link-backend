import type { Metadata } from 'next';
import { Inter, Manrope, JetBrains_Mono, Bricolage_Grotesque } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Trail Link | Deep Linking Platform',
  description: 'Trail Link by AllEvents — deep links, deferred deep links, and attribution. One SDK. Every platform.',
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
      <html
        lang="en"
        suppressHydrationWarning
        className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable} ${bricolage.variable}`}
      >
        <body style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
