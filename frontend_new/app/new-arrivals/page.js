import { redirect } from 'next/navigation';

/**
 * /new-arrivals redirect -> landing page #new-arrivals section.
 *
 * The sitemap.xml and robots.txt reference this URL, and several internal
 * links point here. The actual new-arrivals section lives on the landing page
 * under the "new-arrivals" id. A permanent redirect keeps SEO juice and
 * prevents 404s.
 */
export default function NewArrivalsPage() {
  redirect('/#new-arrivals');
}
