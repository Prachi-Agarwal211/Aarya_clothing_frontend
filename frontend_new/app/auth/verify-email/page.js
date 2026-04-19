'use client';

import React, { Suspense } from 'react';
import VerifyEmailPageContent from './VerifyEmailPageContent';

// Wrap the page with Suspense to handle useSearchParams
function VerifyEmailPageWrapper({ searchParams }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailPageContent searchParams={searchParams} />
    </Suspense>
  );
}

export default VerifyEmailPageWrapper;
