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

  if (enabled && (desktop || mobile)) {
    const d = desktop || mobile;
    const m = mobile || desktop;

    if (d && m && d === m) {
      links.push(
        <link
          key="intro-preload-unified"
          rel="preload"
          href={d}
          as="video"
          type={getVideoTypeHint(d)}
        />
      );
    } else {
      if (d) {
        links.push(
          <link
            key="intro-preload-desktop"
            rel="preload"
            href={d}
            as="video"
            type={getVideoTypeHint(d)}
            media="(min-width: 769px)"
          />
        );
      }
      if (m) {
        links.push(
          <link
            key="intro-preload-mobile"
            rel="preload"
            href={m}
            as="video"
            type={getVideoTypeHint(m)}
            media="(max-width: 768px)"
          />
        );
      }
    }
  }

  return (
    <>
      {links}
      {children}
    </>
  );
}
