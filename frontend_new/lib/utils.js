import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Use with next/image when src is blob: or data: (optimizer cannot fetch those). */
export function isNextImageUnoptimizedSrc(src) {
  return typeof src === "string" && (src.startsWith("blob:") || src.startsWith("data:"));
}
