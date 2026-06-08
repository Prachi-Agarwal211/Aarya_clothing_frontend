'use client';

import dynamic from 'next/dynamic';

const CartDrawer = dynamic(() => import('./cart/CartDrawer'), {
  ssr: false,
  loading: () => null,
});

const CustomerChatWidget = dynamic(() => import('./chat/CustomerChatWidget'), {
  ssr: false,
  loading: () => null,
});

const BottomNavigation = dynamic(() => import('./common/BottomNavigation'), {
  ssr: false,
  loading: () => <div className="h-16 md:hidden" />,
});

/**
 * ClientShell — lazy-loaded client-only components.
 * Wrapped in a 'use client' boundary so ssr:false is allowed with next/dynamic.
 * Renders inside the provider tree in layout.js but doesn't block SSR of page content.
 */
export default function ClientShell() {
  return (
    <>
      <CartDrawer />
      <BottomNavigation />
      <CustomerChatWidget />
    </>
  );
}
