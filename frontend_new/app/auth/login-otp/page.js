import { redirect } from 'next/navigation';

/**
 * Login-OTP page now redirects to unified login page.
 * The unified page has a password/OTP toggle built in.
 */
export default async function LoginOtpPage({ searchParams }) {
  const params = await searchParams;
  const raw = params?.redirect_url;
  const redirectUrl = Array.isArray(raw) ? raw[0] : raw || '/products';
  redirect(`/auth/login?redirect_url=${encodeURIComponent(redirectUrl)}`);
}
