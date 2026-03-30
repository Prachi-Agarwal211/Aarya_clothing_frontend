const BASE_URL = 'https://aaryaclothing.in';

export const metadata = {
  title: 'FAQ | Frequently Asked Questions',
  description: 'Find answers to common questions about Aarya Clothing — shipping, returns, sizing, payments, and more.',
  alternates: { canonical: `${BASE_URL}/faq` },
  openGraph: {
    title: 'FAQ | Aarya Clothing',
    description: 'Answers to your questions about orders, shipping, returns, and payments.',
    url: `${BASE_URL}/faq`,
    siteName: 'Aarya Clothing',
  },
};

export default function FaqLayout({ children }) {
  return children;
}
