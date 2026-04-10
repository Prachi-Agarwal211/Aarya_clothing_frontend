import { redirect } from 'next/navigation';

/**
 * Legacy route — registration uses in-app OTP verification, not email-link flow.
 * Keep URL stable for old bookmarks by sending users to register.
 */
export default function CheckEmailRedirectPage() {
  redirect('/auth/register');
}
