import { fetchSiteConfigForPreload, getVideoTypeHint } from '@/lib/server/siteConfig';

/**
 * Route group `(landing)` only wraps `/` so we can preload intro videos from the same
 * public API the client uses (SiteConfigProvider + IntroVideo) — desktop vs phone URLs
 * come from admin (`intro_video_url_desktop` / `intro_video_url_mobile` on backend).
 */
export const dynamic = 'force-dynamic';

export default async function LandingRootLayout({ children }) {
  const config = await fetchSiteConfigForPreload();
  const video = config?.video;
  const enabled = video?.enabled !== false;
  const desktop = typeof video?.desktop === 'string' ? video.desktop.trim() : '';
  const mobile = typeof video?.mobile === 'string' ? video.mobile.trim() : '';

  const links = [];

  // Edge/Chromium log warnings for rel=preload as="video". Prefetch warms cache without invalid `as`.
  if (enabled && desktop) {
    links.push(
      <link
        key="intro-prefetch-desktop"
        rel="prefetch"
        href={desktop}
        type={getVideoTypeHint(desktop)}
        media="(min-width: 769px)"
      />
    );
  }

  return (
    <>
      {links}
      {children}
    </>
  );
}
