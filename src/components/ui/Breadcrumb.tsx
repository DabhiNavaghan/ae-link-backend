'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const pathname = usePathname();
  const pathSegments = pathname.split('/').filter((s) => s && s !== 'dashboard');

  const defaultItems: BreadcrumbItem[] =
    items ||
    pathSegments.map((segment, index) => ({
      label: segment.charAt(0).toUpperCase() + segment.slice(1),
      href:
        index < pathSegments.length - 1
          ? `/dashboard/${pathSegments.slice(0, index + 1).join('/')}`
          : undefined,
    }));

  return (
    <nav className="flex items-center gap-2 text-sm">
      <Link
        href="/dashboard"
        className="transition-colors duration-200"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Dashboard
      </Link>
      {defaultItems.map((item, index) => (
        <React.Fragment key={index}>
          <span style={{ color: 'var(--color-text-tertiary)' }}>/</span>
          {item.href ? (
            <Link
              href={item.href}
              className="transition-colors duration-200"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
