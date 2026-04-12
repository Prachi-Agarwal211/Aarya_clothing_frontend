'use client';

import ErrorPage from '@/components/shared/ErrorPage';

export default function ProfileError({ error, reset }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Profile Error"
      message="Failed to load your profile. Please try again."
    />
  );
}
