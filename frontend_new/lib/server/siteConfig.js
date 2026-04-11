import { getCoreBaseUrl } from '@/lib/baseApi';

/**
 * Server-only: fetch public site config (same payload as GET /api/v1/site/config).
 * Used to emit <link rel="preload"> for admin-configured intro videos (desktop + mobile).
 * Must stay aligned with core service `get_site_config` (intro_video_url_desktop / _mobile).
 */
export async function fetchSiteConfigForPreload() {
  const base = getCoreBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/site/config`;

  try {
    const res = await fetch(url, {
      // Admin can change intro videos — avoid stale preloads
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Map file extension to preload `as` type hint */
export function getVideoTypeHint(url) {
  if (!url || typeof url !== 'string') return 'video/mp4';
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return 'video/mp4';
}
