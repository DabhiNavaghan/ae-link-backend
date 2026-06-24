'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
}

const isObjectId = (s: string) => /^[a-f0-9]{24}$/.test(s);

/** Call from any page to set a human-readable title for ObjectId breadcrumb segments */
export function setBreadcrumbTitle(title: string | undefined) {
  window.dispatchEvent(new CustomEvent('breadcrumb-title', { detail: title }));
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const pathname = usePathname();
  const pathSegments = pathname.split('/').filter((s) => s && s !== 'dashboard');
  const [pageTitle, setPageTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (e: Event) => setPageTitle((e as CustomEvent).detail);
    window.addEventListener('breadcrumb-title', handler);
    return () => {
      window.removeEventListener('breadcrumb-title', handler);
      setPageTitle(undefined);
    };
  }, [pathname]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const defaultItems: BreadcrumbItem[] =
    items ||
    pathSegments
      .map((segment, index) => ({
        label: isObjectId(segment)
          ? (pageTitle || '')           // empty while loading — filtered out below
          : segment.charAt(0).toUpperCase() + segment.slice(1),
        href:
          index < pathSegments.length - 1
            ? `/dashboard/${pathSegments.slice(0, index + 1).join('/')}`
            : undefined,
        _isObjectId: isObjectId(segment),
      }))
      .filter((item) => item.label !== '')              // hide ObjectId segments until title loads
      .filter((item) => !(isMobile && (item as any)._isObjectId));  // hide link name on mobile

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
