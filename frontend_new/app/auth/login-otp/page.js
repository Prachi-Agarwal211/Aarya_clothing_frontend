import React, { Suspense } from 'react';
import LoginOtpPageContent from './LoginOtpPageContent';

export default async function LoginOtpPage({ searchParams }) {
  const params = await searchParams;
  const raw = params?.redirect_url;
  const redirectUrl = Array.isArray(raw) ? raw[0] : raw || '/products';
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading…</div>}>
      <LoginOtpPageContent redirectUrl={redirectUrl} />
    </Suspense>
  );
}
