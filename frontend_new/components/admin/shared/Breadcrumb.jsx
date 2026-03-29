'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Breadcrumb - Navigation breadcrumb component
 * Automatically generates breadcrumbs from current path
 *
 * @param {Array} items - Optional manual breadcrumb items (overrides auto-generation)
 * @param {string} homeLabel - Label for home link (default: 'Home')
 * @param {string} homeHref - Home link href (default: '/admin')
 */
export default function Breadcrumb({ items, homeLabel = 'Home', homeHref = '/admin' }) {
  const pathname = usePathname();

  // Generate breadcrumbs from path if items not provided
  const breadcrumbs = items || generateBreadcrumbs(pathname);

  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return (
    <nav
      className="flex items-center gap-1 text-sm overflow-x-auto pb-1"
      aria-label="Breadcrumb"
      role="navigation"
    >
      <ol className="flex items-center gap-1 min-w-0">
        {/* Home link */}
        <li>
          <Link
            href={homeHref}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg',
              'text-[#EAE0D5]/50 hover:text-[#EAE0D5]/80',
              'transition-colors',
              'min-h-[44px] min-w-[44px] touch-target'
            )}
            aria-label={homeLabel}
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">{homeLabel}</span>
          </Link>
        </li>

        {/* Breadcrumb items */}
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <li key={item.href || item.label} className="flex items-center">
              {/* Separator */}
              <ChevronRight
                className="w-4 h-4 text-[#EAE0D5]/30 mx-1 flex-shrink-0"
                aria-hidden="true"
              />

              {/* Breadcrumb link or current page */}
              {isLast ? (
                <span
                  className={cn(
                    'px-2 py-1 rounded-lg',
                    'text-[#F2C29A] font-medium',
                    'bg-[#7A2F57]/20 border border-[#B76E79]/20',
                    'truncate max-w-[200px] sm:max-w-none'
                  )}
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg',
                    'text-[#EAE0D5]/50 hover:text-[#EAE0D5]/80',
                    'transition-colors',
                    'truncate max-w-[150px] sm:max-w-none',
                    'min-h-[44px] touch-target'
                  )}
                >
                  {item.icon && <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />}
                  <span className="truncate">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Generate breadcrumbs from pathname
function generateBreadcrumbs(pathname) {
  if (!pathname || pathname === '/' || pathname === '/admin') {
    return [];
  }

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [];

  // Skip 'admin' segment for cleaner URLs
  const pathSegments = segments.filter(seg => seg !== 'admin');

  let href = '/admin';

  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    href = `${href}/${segment}`;

    // Handle numeric IDs (treat as detail pages)
    if (/^\d+$/.test(segment)) {
      // Use previous segment as label prefix
      const prevSegment = pathSegments[i - 1] || 'item';
      breadcrumbs.push({
        label: `#${segment}`,
        href: href,
      });
    } else {
      breadcrumbs.push({
        label: formatLabel(segment),
        href: href,
      });
    }
  }

  return breadcrumbs;
}

// Format segment label (convert kebab-case to Title Case)
function formatLabel(segment) {
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Utility function for class names
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
