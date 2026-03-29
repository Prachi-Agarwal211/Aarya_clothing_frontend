import * as React from "react"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef(({ className, src, alt, fallback, ...props }, ref) => {
  const [loaded, setLoaded] = React.useState(false)

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      {src && (
        <img
          className={cn("aspect-square h-full w-full", loaded ? "opacity-100" : "opacity-0")}
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
        />
      )}
      {!loaded && fallback && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          {fallback}
        </div>
      )}
    </div>
  )
})
Avatar.displayName = "Avatar"

const AvatarFallback = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  >
    {children}
  </div>
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarFallback }
