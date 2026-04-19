'use client';

import React, { Suspense } from 'react';
import LoginPageContent from './LoginPageContent';

// Wrap the page with Suspense to handle useSearchParams
function LoginPageWrapper({ searchParams }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}

export default LoginPageWrapper;
