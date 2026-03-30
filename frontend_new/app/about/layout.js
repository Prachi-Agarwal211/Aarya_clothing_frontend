const BASE_URL = 'https://aaryaclothing.in';

export const metadata = {
  title: 'About Us | Our Story & Craftsmanship',
  description: 'Learn about Aarya Clothing — a premium ethnic wear brand crafting handmade sarees, kurtis, and lehengas. Rooted in Indian artistry and modern design.',
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: 'About Aarya Clothing | Our Story',
    description: 'Rooted in Indian artistry. Discover the story behind Aarya Clothing.',
    url: `${BASE_URL}/about`,
    siteName: 'Aarya Clothing',
  },
};

export default function AboutLayout({ children }) {
  return children;
}
