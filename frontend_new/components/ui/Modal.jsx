'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

/**
 * Modal - Premium modal component with full accessibility support
 *
 * Features:
 * - Portal rendering
 * - Keyboard navigation (Escape to close)
 * - Click outside to close
 * - Smooth animations
 * - Focus trap for accessibility
 * - Scroll lock that releases on close
 * - Proper ARIA attributes
 * - Multiple sizes
 * - Minimum 44px touch targets
 * - Confirmation for destructive actions
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  overlayClassName,
  ariaLabelledBy,
  ariaDescribedBy,
  isDestructive = false,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Handle mount for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Focusable elements selector
  const FOCUSABLE_SELECTORS = [
    'a[href]',
    'area[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
    'audio[controls]',
    'video[controls]',
    'details>summary:first-of-type',
    'details',
  ].join(',');

  // Handle escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEscape) {
      if (isDestructive && onConfirm) {
        // For destructive modals, require explicit confirmation
        return;
      }
      onClose?.();
    }

    // Focus trap
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(FOCUSABLE_SELECTORS);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
  }, [closeOnEscape, onClose, isDestructive, onConfirm]);

  // Handle overlay click
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      if (isDestructive && onConfirm) {
        return;
      }
      onClose?.();
    }
  }, [closeOnOverlayClick, onClose, isDestructive, onConfirm]);

  // Focus management and scroll lock
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = 'var(--scrollbar-offset, 0px)';
      document.addEventListener('keydown', handleKeyDown);

      // Focus first focusable element after a short delay
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll(FOCUSABLE_SELECTORS);
          const closeButton = modalRef.current.querySelector('[data-close-button]');
          (closeButton || focusableElements[0])?.focus();
        }
      }, 50);

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        document.removeEventListener('keydown', handleKeyDown);
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, handleKeyDown]);

  // Handle close with animation
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose?.();
    }, 200);
  }, [isClosing, onClose]);

  if (!mounted || !isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] max-h-[95vh]',
  };

  const modalContent = (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/60 backdrop-blur-sm',
        'transition-opacity duration-200',
        isClosing ? 'opacity-0' : 'opacity-100',
        overlayClassName
      )}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy || 'modal-title'}
      aria-describedby={ariaDescribedBy}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-[#0B0608] border border-[#B76E79]/30 rounded-2xl shadow-2xl',
          'flex flex-col max-h-[90vh]',
          'transition-all duration-200',
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
          sizes[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#B76E79]/20 flex-shrink-0">
            {title && (
              <h2
                id="modal-title"
                className="text-lg font-bold text-[#F2C29A]"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                ref={(btn) => {
                  if (btn && !previousActiveElement.current) {
                    btn.focus();
                  }
                }}
                onClick={handleClose}
                data-close-button
                aria-label="Close modal"
                className={cn(
                  'p-2 rounded-xl hover:bg-[#B76E79]/10 transition-colors',
                  'text-[#EAE0D5]/60 hover:text-[#EAE0D5]',
                  'min-w-[44px] min-h-[44px] touch-target'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Body - Scrollable when content overflows */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>

        {/* Footer for destructive actions */}
        {isDestructive && onConfirm && (
          <div className="p-4 sm:p-6 border-t border-[#B76E79]/20 flex gap-3 flex-shrink-0 bg-[#0B0608]">
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                'flex-1 py-2.5 rounded-xl border border-[#B76E79]/30',
                'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm',
                'min-h-[44px] touch-target'
              )}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                handleClose();
              }}
              className={cn(
                'flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30',
                'text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium',
                'min-h-[44px] touch-target'
              )}
            >
              {confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
