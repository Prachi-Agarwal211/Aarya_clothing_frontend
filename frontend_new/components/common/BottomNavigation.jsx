'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, User, Search } from 'lucide-react';
import { useCart } from '@/lib/cartContext';
import { useAuth } from '@/lib/authContext';
import { cn } from '@/lib/utils';
import { useIntroVideoOverlay } from '@/lib/introVideoOverlayContext';

const BottomNavigation = () => {
    const pathname = usePathname();
    const { introOverlayActive } = useIntroVideoOverlay();
    const { itemCount, toggleCart } = useCart();
    const { user, isAuthenticated } = useAuth();

    const isStaff = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'staff';

    const handleCartClick = (e) => {
        e.preventDefault();
        toggleCart();
    };

    const navItems = [
        {
            label: 'Home',
            icon: Home,
            href: '/',
            isActive: pathname === '/'
        },
        {
            label: 'Shop',
            icon: Search,
            href: '/products',
            isActive: pathname === '/products' || pathname.startsWith('/collections')
        },
        {
            label: 'Cart',
            icon: ShoppingBag,
            href: '#cart',
            onClick: handleCartClick,
            isActive: false,
            badge: itemCount > 0 ? itemCount : null
        },
        {
            label: 'Profile',
            icon: User,
            href: isAuthenticated ? (isStaff ? '/admin' : '/profile') : '/auth/login?redirect_url=/profile',
            isActive: pathname === '/profile' || pathname.startsWith('/admin')
        }
    ];

    // CSS md:hidden handles desktop hiding — no SSR gate needed
    if (pathname.startsWith('/admin')) return null;
    if (pathname.startsWith('/checkout')) return null;
    if (introOverlayActive) return null;

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[#0B0608]/95 backdrop-blur-md border-t border-[#B76E79]/20 pb-safe">
            <div className="flex items-center justify-around px-2 min-h-[64px]">
                {navItems.map((item) => {
                    const Component = item.onClick ? 'button' : Link;
                    const props = item.onClick 
                        ? { type: 'button', onClick: item.onClick } 
                        : { href: item.href };

                    return (
                        <Component
                            key={item.label}
                            {...props}
                            className={cn(
                                "relative flex flex-col items-center justify-center w-full min-h-[44px] py-2 gap-1 transition-colors",
                                item.isActive ? "text-[#F2C29A]" : "text-[#EAE0D5]/60 hover:text-[#EAE0D5]"
                            )}
                            aria-label={item.label}
                        >
                            <div className="relative">
                                <item.icon className={cn("w-6 h-6", item.isActive && "fill-current opacity-20")} strokeWidth={item.isActive ? 2.5 : 2} />
                                {item.badge !== null && (
                                    <span className="absolute -top-2 -right-2 bg-[#7A2F57] text-[#EAE0D5] text-[10px] min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 font-medium">
                                        {item.badge > 9 ? '9+' : item.badge}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-medium tracking-wide">
                                {item.label}
                            </span>
                            {item.isActive && (
                                <span className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-8 h-[2px] bg-gradient-to-r from-[#7A2F57] via-[#F2C29A] to-[#7A2F57] rounded-b-full" />
                            )}
                        </Component>
                    );
                })}
            </div>
        </div>
    );
};

export default BottomNavigation;
