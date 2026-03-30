const BASE_URL = 'https://aaryaclothing.in';

export const metadata = {
  title: 'Contact Us | Get In Touch',
  description: 'Contact Aarya Clothing for order support, product enquiries, or any help. Chat with us live or reach us by email and phone.',
  alternates: { canonical: `${BASE_URL}/contact` },
  openGraph: {
    title: 'Contact Aarya Clothing',
    description: 'Chat with our support team or reach us by email and phone.',
    url: `${BASE_URL}/contact`,
    siteName: 'Aarya Clothing',
  },
};

export default function ContactLayout({ children }) {
  return children;
}
