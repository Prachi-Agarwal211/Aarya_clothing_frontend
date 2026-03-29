'use client';

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/**
 * Dialog - Accessible dialog component with proper ARIA attributes
 * Based on Radix UI Dialog patterns
 */

const DialogContext = React.createContext({
  open: false,
  onOpenChange: () => {},
});

const Dialog = ({ open, onOpenChange, children, className }) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when dialog is open
  React.useEffect(() => {
    if (open) {
      const previousOverflow = document.body.style.overflow;
      const previousPaddingRight = document.body.style.paddingRight;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = 'var(--scrollbar-offset, 0px)';

      return () => {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPaddingRight;
      };
    }
  }, [open]);

  if (!mounted) return null;

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {open && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center p-4",
            "bg-black/60 backdrop-blur-sm",
            "transition-opacity duration-200",
            className
          )}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </div>
      )}
      {!open && children}
    </DialogContext.Provider>
  );
};

const DialogTrigger = React.forwardRef(({ asChild = false, children, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext);

  const Comp = asChild ? React.Fragment : "button";

  const handleClick = () => {
    onOpenChange(true);
  };

  if (asChild) {
    return React.cloneElement(children, {
      onClick: (e) => {
        children.props.onClick?.(e);
        handleClick();
      },
    });
  }

  return (
    <Comp
      ref={ref}
      onClick={handleClick}
      className={cn("touch-target", props.className)}
      {...props}
    >
      {children}
    </Comp>
  );
});
DialogTrigger.displayName = "DialogTrigger";

const DialogContent = React.forwardRef(({ className, children, showCloseButton = true, ...props }, ref) => {
  const { onOpenChange } = React.useContext(DialogContext);
  const contentRef = React.useRef(null);

  // Combine refs
  React.useImperativeHandle(ref, () => contentRef.current);

  // Focus trap
  React.useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const focusableElements = content.querySelectorAll(
      'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable], audio[controls], video[controls], details>summary:first-of-type, details'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // Focus first element on mount
    const closeButton = content.querySelector('[data-close-button]');
    (closeButton || firstElement)?.focus();

    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, []);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onOpenChange]);

  // Handle overlay click
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    <div
      onClick={handleOverlayClick}
      className="relative z-50 w-full max-w-lg"
    >
      <div
        ref={contentRef}
        className={cn(
          "relative grid w-full max-w-lg gap-4 border border-[#B76E79]/30",
          "bg-[#0B0608] p-6 shadow-xl sm:rounded-2xl",
          "max-h-[90vh] overflow-y-auto",
          "transition-all duration-200",
          className
        )}
        role="document"
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            data-close-button
            onClick={() => onOpenChange(false)}
            aria-label="Close dialog"
            className={cn(
              "absolute right-4 top-4 rounded-xl p-2",
              "text-[#EAE0D5]/60 hover:text-[#EAE0D5]",
              "hover:bg-[#B76E79]/10 transition-colors",
              "min-w-[44px] min-h-[44px] touch-target"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
});
DialogContent.displayName = "DialogContent";

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[#EAE0D5]/60", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

const DialogHeader = ({ className, ...props }) => (
  <div
    className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    id="dialog-title"
    className={cn(
      "text-lg font-bold leading-none tracking-tight text-[#F2C29A]",
      "font-['Cinzel',serif]",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
};
