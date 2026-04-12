'use client';

import ErrorPage from '@/components/shared/ErrorPage';

export default function AdminError({ error, reset }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Admin Dashboard Error"
      message="An error occurred in the admin dashboard. Please try again or contact support."
    />
  );
}
