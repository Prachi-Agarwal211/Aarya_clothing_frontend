/**
 * Product Detail Layout
 * 
 * Note: Canonical redirect logic has been moved to page.js to prevent
 * double-fetching and navigation jitter. This layout now simply renders
 * children without any redirects.
 * 
 * See: https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes
 * See: https://nextjs.org/docs/app/building-your-application/data-fetching/fetching
 */

export default function ProductDetailLayout({ children }) {
  return <>{children}</>;
}
