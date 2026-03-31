// Collection layout - removed duplicate API fetches
// All data fetching now happens in page.js to avoid duplication
// This layout only handles structured data injection via children

export default async function CollectionLayout({ children }) {
  // No API calls here - all data fetching moved to page.js
  // This prevents duplicate requests and reduces server load
  
  return (
    <>
      {children}
    </>
  );
}
