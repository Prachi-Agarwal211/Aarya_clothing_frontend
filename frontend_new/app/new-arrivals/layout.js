const BASE_URL = 'https://aaryaclothing.in';

export const metadata = {
  title: 'New Arrivals | Latest Ethnic Wear',
  description: 'Shop the latest arrivals at Aarya Clothing. Fresh sarees, kurtis, lehengas and more added regularly. Free shipping across India.',
  alternates: { canonical: `${BASE_URL}/new-arrivals` },
  openGraph: {
    title: 'New Arrivals | Aarya Clothing',
    description: 'Fresh ethnic wear added regularly. Shop the latest sarees, kurtis, lehengas.',
    url: `${BASE_URL}/new-arrivals`,
    siteName: 'Aarya Clothing',
  },
};

export default function NewArrivalsLayout({ children }) {
  return children;
}
