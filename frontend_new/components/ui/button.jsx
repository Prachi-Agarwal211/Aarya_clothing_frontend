import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";
import Link from "next/link";

import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden group font-serif",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90 rounded-md",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 rounded-md",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 rounded-md",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-md",
        link: "text-primary underline-offset-4 hover:underline",
        // Premium Luxury variants with enhanced styling
        luxury: `
          bg-transparent border border-[#B76E79]/40 
          hover:border-[#F2C29A]/70 
          hover:shadow-[0_0_40px_rgba(183,110,121,0.4),0_0_80px_rgba(242,194,154,0.1)]
          rounded-2xl text-[#F2C29A] group-hover:text-white
          btn-ripple btn-glow
          transform hover:scale-[1.02] hover:-translate-y-0.5
          active:scale-[0.98]
        `,
        luxurySecondary: `
          bg-transparent border border-[#F2C29A]/50 
          hover:border-[#F2C29A]/90 
          hover:shadow-[0_0_35px_rgba(242,194,154,0.3),0_0_70px_rgba(183,110,121,0.15)]
          rounded-2xl text-[#F2C29A] group-hover:text-white
          btn-ripple
          transform hover:scale-[1.02] hover:-translate-y-0.5
          active:scale-[0.98]
        `,
        luxuryAccent: `
          bg-[#7A2F57]/80 border border-[#B76E79]/30 
          hover:bg-[#8D3664] 
          hover:shadow-[0_0_40px_rgba(122,47,87,0.5),0_0_80px_rgba(183,110,121,0.2)]
          rounded-2xl text-[#EAE0D5] group-hover:text-white
          btn-ripple btn-glow
          transform hover:scale-[1.02] hover:-translate-y-0.5
          active:scale-[0.98]
        `,
        luxuryGhost: `
          bg-transparent border border-transparent
          hover:bg-white/5 hover:border-[#F2C29A]/30
          rounded-2xl text-[#EAE0D5] group-hover:text-[#F2C29A]
          transform hover:scale-[1.01]
          active:scale-[0.99]
        `,
        // New Premium Solid variant
        luxurySolid: `
          bg-gradient-to-r from-[#7A2F57] via-[#B76E79] to-[#7A2F57]
          bg-size-200
          hover:bg-right
          border border-[#F2C29A]/30
          rounded-2xl text-[#F2C29A]
          shadow-[0_4px_20px_rgba(122,47,87,0.4)]
          hover:shadow-[0_8px_40px_rgba(183,110,121,0.5)]
          btn-ripple
          transform hover:scale-[1.03] hover:-translate-y-1
          active:scale-[0.98]
        `,
        // Hero-specific variants - White buttons with silk text animation
        heroLuxury: `
          bg-white
          hover:bg-white
          border-0
          hover:shadow-[0_8px_40px_rgba(255,255,255,0.4),0_0_60px_rgba(242,194,154,0.3)]
          rounded-full
          transform hover:scale-[1.02] hover:-translate-y-1
          active:scale-[0.98]
          transition-all duration-300
        `,
        heroLuxuryOutline: `
          bg-white
          hover:bg-white
          border-0
          hover:shadow-[0_8px_40px_rgba(255,255,255,0.4),0_0_60px_rgba(242,194,154,0.3)]
          rounded-full
          transform hover:scale-[1.02] hover:-translate-y-1
          active:scale-[0.98]
          transition-all duration-300
        `,
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-12 px-6 text-base tracking-[0.1em] rounded-2xl",
        md: "h-14 sm:h-16 px-8 text-lg sm:text-xl tracking-[0.1em] sm:tracking-[0.15em] rounded-2xl",
        lg: "h-16 sm:h-18 px-10 text-xl sm:text-2xl tracking-[0.15em] rounded-2xl",
        hero: "h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base tracking-[0.15em] uppercase",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Button - Extended shadcn Button with premium luxury variants
 * 
 * Premium Luxury variants:
 * - luxury: Primary luxury button with gradient, sheen, glow, and ripple
 * - luxurySecondary: Secondary luxury button with enhanced border effects
 * - luxuryAccent: Accent luxury button with solid gradient background
 * - luxuryGhost: Ghost luxury button with minimal styling
 * - luxurySolid: Premium solid gradient button with hover animation
 * 
 * Features:
 * - Ripple effect on click
 * - Glow effect on hover
 * - Smooth scale animations
 * - Premium sheen animation
 * - Gradient borders
 * 
 * Usage:
 * <Button variant="luxury" size="lg">Shop Now</Button>
 * <Button variant="luxurySecondary" asChild><Link href="/shop">Explore</Link></Button>
 */
const Button = React.forwardRef(({ 
  className, 
  variant, 
  size, 
  asChild = false, 
  href,
  ...props 
}, ref) => {
  // Check if it's a luxury variant
  const isLuxury = variant?.startsWith('luxury');
  const isHero = variant?.startsWith('hero');
  
  // For hero variants - white buttons with silk text animation
  const heroContent = isHero ? (
    <>
      {/* Button Text with Silk Shimmer Effect */}
      <span 
        className="relative z-10 flex items-center justify-center gap-2 w-full"
        style={{ fontFamily: 'Cinzel, serif' }}
      >
        <span className="silk-text-animate">{props.children}</span>
      </span>
    </>
  ) : null;
  
  // For luxury variants, add the gradient and sheen elements
  const luxuryContent = isLuxury ? (
    <>
      {/* Gradient Background Layer */}
      {variant === 'luxury' && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90 rounded-2xl transition-opacity duration-500 group-hover:opacity-100" />
      )}
      {variant === 'luxurySecondary' && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#2A1208]/60 via-[#B76E79]/40 to-[#7A2F57]/60 opacity-80 rounded-2xl transition-opacity duration-500 group-hover:opacity-100" />
      )}
      {variant === 'luxurySolid' && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57] via-[#B76E79] to-[#7A2F57] bg-[length:200%_100%] animate-gradient rounded-2xl transition-all duration-500" />
      )}
      
      {/* Premium Sheen Animation */}
      <div className="animate-sheen rounded-2xl" />
      
      {/* Top Highlight Line with Glow */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A]/80 to-transparent rounded-2xl opacity-80 group-hover:opacity-100 transition-opacity" />
      
      {/* Bottom Highlight Line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#B76E79]/60 to-transparent rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity" />
      
      {/* Side Accent Lines */}
      <div className="absolute top-2 bottom-2 left-0 w-[1px] bg-gradient-to-b from-transparent via-[#F2C29A]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute top-2 bottom-2 right-0 w-[1px] bg-gradient-to-b from-transparent via-[#F2C29A]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Button Text with Premium Styling */}
      <span 
        className="relative z-10 flex items-center justify-center gap-2 w-full tracking-wider"
        style={{ fontFamily: 'Cinzel, serif' }}
      >
        {props.children}
      </span>
    </>
  ) : null;
  
  // Determine which content to render
  const buttonContent = isHero ? heroContent : (isLuxury ? luxuryContent : props.children);

  // Handle link rendering
  if (href) {
    return (
      <Link
        href={href}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {buttonContent}
      </Link>
    );
  }

  // Handle asChild (Radix Slot)
  const Comp = asChild ? Slot : "button"
  
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    >
      {buttonContent}
    </Comp>
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
