import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartLink | AllEvents Deep Link Platform',
  description: 'SmartLink: Smart deep linking for AllEvents',
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
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
