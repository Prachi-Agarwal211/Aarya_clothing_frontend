import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";
import Link from "next/link";

import { cn } from "../../lib/utils"

/**
 * Royal metallic buttons — gold + steel on blue-black.
 * No pink/purple gradients.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D4AF37]/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden group",
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
        luxury: `
          bg-transparent border border-[#A8B4C8]/20
          hover:border-[#D4AF37]/45
          rounded-2xl text-[#D4AF37]
          transform hover:scale-[1.01] active:scale-[0.98]
        `,
        luxurySecondary: `
          bg-transparent border border-[#A8B4C8]/25
          hover:border-[#D4AF37]/40
          rounded-2xl text-[#F5F0E8]
          transform hover:scale-[1.01] active:scale-[0.98]
        `,
        luxuryAccent: `
          bg-[#1E3A5F]/90 border border-[#D4AF37]/25
          hover:bg-[#2C4A7C] hover:border-[#D4AF37]/40
          rounded-2xl text-[#F5F0E8]
          transform hover:scale-[1.01] active:scale-[0.98]
        `,
        luxuryGhost: `
          bg-transparent border border-transparent
          hover:bg-white/[0.04] hover:border-[#D4AF37]/25
          rounded-2xl text-[#F5F0E8] group-hover:text-[#D4AF37]
          transform hover:scale-[1.01] active:scale-[0.99]
        `,
        luxurySolid: `
          bg-gradient-to-r from-[#1E3A5F] via-[#2C4A7C] to-[#1E3A5F]
          border border-[#D4AF37]/30
          rounded-2xl text-[#D4AF37]
          shadow-metallic-sm
          hover:border-[#D4AF37]/50
          transform hover:scale-[1.01] active:scale-[0.98]
        `,
        /* Primary hero CTA — pure white (premium, not yellow) */
        heroLuxury: `
          bg-white
          hover:bg-[#F7F4EE]
          border border-white/90
          text-[#0D0D0D] font-medium
          rounded-full
          shadow-[0_4px_24px_rgba(255,255,255,0.12)]
          hover:shadow-[0_8px_32px_rgba(255,255,255,0.18)]
          transform hover:scale-[1.02] hover:-translate-y-0.5
          active:scale-[0.98]
          transition-all duration-300
        `,
        /* Secondary hero CTA — gold metallic outline (true gold, not yellow fill) */
        heroLuxuryOutline: `
          bg-transparent
          border border-[#D4AF37]/55
          text-white
          hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/85 hover:text-[#F0D78C]
          rounded-full
          shadow-[inset_0_1px_0_rgba(240,215,140,0.15)]
          transform hover:scale-[1.02] hover:-translate-y-0.5
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

const Button = React.forwardRef(({
  className,
  variant,
  size,
  asChild = false,
  href,
  ...props
}, ref) => {
  const isLuxury = variant?.startsWith('luxury');
  const isHero = variant?.startsWith('hero');

  const heroContent = isHero ? (
    <span
      className="relative z-10 flex items-center justify-center gap-2 w-full"
      style={{ fontFamily: 'Cinzel, serif' }}
    >
      {props.children}
    </span>
  ) : null;

  const luxuryContent = isLuxury ? (
    <>
      {variant === 'luxury' && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F]/70 via-[#161616]/85 to-[#111111]/90 opacity-90 rounded-2xl transition-opacity duration-500 group-hover:opacity-100" />
      )}
      {variant === 'luxurySecondary' && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#152238]/80 via-[#1C1C1C]/70 to-[#1E3A5F]/50 opacity-85 rounded-2xl" />
      )}
      {variant === 'luxurySolid' && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#152238] via-[#1E3A5F] to-[#152238] rounded-2xl" />
      )}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent opacity-70 group-hover:opacity-100" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#A8B4C8]/25 to-transparent" />
      <span
        className="relative z-10 flex items-center justify-center gap-2 w-full tracking-wider"
        style={{ fontFamily: 'Cinzel, serif' }}
      >
        {props.children}
      </span>
    </>
  ) : null;

  const buttonContent = isHero ? heroContent : (isLuxury ? luxuryContent : props.children);

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
