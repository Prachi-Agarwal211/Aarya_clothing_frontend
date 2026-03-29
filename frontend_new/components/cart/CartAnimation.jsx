'use client';

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Cart Animation Context
const CartAnimationContext = createContext(null);

/**
 * CartAnimationProvider - Provides cart animation functionality
 * 
 * Features:
 * - Fly to cart animation
 * - Item add/remove effects
 * - Cart badge pulse
 * - Proper cleanup for all animations
 */
export const CartAnimationProvider = ({ children }) => {
  const cartIconRef = useRef(null);
  const animationTimeoutsRef = useRef([]);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      animationTimeoutsRef.current.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      animationTimeoutsRef.current = [];
    };
  }, []);

  const registerCartIcon = useCallback((ref) => {
    cartIconRef.current = ref;
  }, []);

  const flyToCart = useCallback((sourceElement) => {
    if (!sourceElement || !cartIconRef.current) return;

    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = cartIconRef.current.getBoundingClientRect();

    // Create flying element
    const flyingElement = document.createElement('div');
    flyingElement.className = 'cart-fly-element';
    flyingElement.innerHTML = `
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    `;
    document.body.appendChild(flyingElement);

    // Set initial position
    flyingElement.style.left = `${sourceRect.left + sourceRect.width / 2}px`;
    flyingElement.style.top = `${sourceRect.top + sourceRect.height / 2}px`;

    // Animate to cart
    requestAnimationFrame(() => {
      flyingElement.style.transform = `translate(${targetRect.left - sourceRect.left}px, ${targetRect.top - sourceRect.top}px) scale(0.5)`;
      flyingElement.style.opacity = '0';
    });

    // Remove after animation - with tracked timeout for cleanup
    const timeoutId1 = setTimeout(() => {
      flyingElement.remove();
      // Pulse cart icon
      if (cartIconRef.current) {
        cartIconRef.current.classList.add('cart-pulse');
        const timeoutId2 = setTimeout(() => {
          cartIconRef.current?.classList.remove('cart-pulse');
        }, 500);
        animationTimeoutsRef.current.push(timeoutId2);
      }
    }, 500);
    animationTimeoutsRef.current.push(timeoutId1);
  }, []);

  return (
    <CartAnimationContext.Provider value={{ registerCartIcon, flyToCart }}>
      {children}
    </CartAnimationContext.Provider>
  );
};

/**
 * useCartAnimation - Hook to access cart animation functions
 */
export const useCartAnimation = () => {
  const context = useContext(CartAnimationContext);
  if (!context) {
    return {
      registerCartIcon: () => {},
      flyToCart: () => {},
    };
  }
  return context;
};

/**
 * CartIconWrapper - Wrapper for cart icon with animation ref
 */
export const CartIconWrapper = ({ children, className }) => {
  const { registerCartIcon } = useCartAnimation();
  const iconRef = useRef(null);

  React.useEffect(() => {
    if (iconRef.current) {
      registerCartIcon(iconRef);
    }
  }, [registerCartIcon]);

  return (
    <div ref={iconRef} className={cn('cart-icon-wrapper', className)}>
      {children}
    </div>
  );
};

/**
 * AddToCartButton - Button with fly-to-cart animation
 */
export const AddToCartButton = ({
  children,
  onClick,
  product,
  className,
  disabled,
  ...props
}) => {
  const buttonRef = useRef(null);
  const { flyToCart } = useCartAnimation();

  const handleClick = (e) => {
    // Trigger fly animation
    flyToCart(buttonRef.current);
    
    // Call original onClick
    onClick?.(e);
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'add-to-cart-btn',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

/**
 * CartItemAnimation - Wrapper for cart item animations
 */
export const CartItemAnimation = ({
  children,
  isAdding,
  isRemoving,
  className,
}) => {
  return (
    <div
      className={cn(
        'cart-item-animation',
        isAdding && 'cart-item-entering',
        isRemoving && 'cart-item-leaving',
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * CartBadge - Animated cart badge
 */
export const CartBadge = ({ count, className }) => {
  return (
    <span className={cn('cart-badge', className)}>
      {count > 99 ? '99+' : count}
    </span>
  );
};

export default CartAnimationProvider;
