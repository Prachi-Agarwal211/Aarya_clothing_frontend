'use client';

import ErrorPage from '@/components/shared/ErrorPage';

export default function CheckoutError({ error, reset }) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Checkout Error"
      message="An error occurred during checkout. Please try again."
    />
  );
}
