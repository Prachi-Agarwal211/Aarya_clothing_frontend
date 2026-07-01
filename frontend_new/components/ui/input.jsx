import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Input - Premium styled input component with luxury theme
 * 
 * Features:
 * - Glass morphism effect
 * - Focus glow animation
 * - Premium border styling
 * - Smooth transitions
 * - Two variants: "default" (standalone) and "minimal" (for use inside luxury-input-wrapper)
 * 
 * @param {Object} props - Component props
 * @param {string} props.variant - "default" | "minimal" - minimal removes border/bg/blur for use inside wrappers
 */
const Input = React.forwardRef(({ className, type, variant = "default", ...props }, ref) => {
  const baseStyles = "flex h-12 w-full px-4 py-3 text-sm text-[#F5F5F5] transition-all duration-400 placeholder:text-[#737373]/70 placeholder:font-light focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium";
  
  const variants = {
    default: cn(
      "rounded-xl border border-[#E07B8B]/30 bg-[#0A0A0A]/40 backdrop-blur-md shadow-lg",
      "focus:border-[#FFD700]/50 focus:bg-[#0A0A0A]/60",
      "focus:shadow-[0_0_20px_rgba(183,110,121,0.2),0_0_40px_rgba(242,194,154,0.1)]",
      "hover:border-[#E07B8B]/50 hover:bg-[#0A0A0A]/50"
    ),
    minimal: cn(
      "bg-transparent border-0 shadow-none backdrop-blur-none",
      "focus:bg-transparent focus:shadow-none"
    )
  };

  return (
    <input
      type={type}
      className={cn(baseStyles, variants[variant], className)}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
