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

const FAQ_ITEMS = [
  { q: 'How can I track my order?', a: 'Once your order is shipped, you will receive an email with a tracking link. You can also track your order by logging into your account and visiting the "My Orders" section.' },
  { q: 'Can I modify or cancel my order?', a: 'We process orders quickly to ensure fast delivery. You can only cancel or modify your order within 2 hours of placing it. Please contact our customer support immediately for assistance.' },
  { q: 'What should I do if I receive a defective item?', a: 'Please contact our support team within 48 hours of receiving the item with photos of the defect, and we will arrange a replacement or refund.' },
  { q: 'How long does shipping take?', a: 'Standard shipping within India takes 3-5 business days. Express shipping is available for select pincodes and takes 1-2 business days.' },
  { q: 'Do you ship internationally?', a: 'Currently, we only ship within India. We are working on expanding our delivery network globally.' },
  { q: 'How much are the shipping charges?', a: 'We offer free standard shipping on all orders above ₹999. For orders below this amount, a nominal fee of ₹99 is applied.' },
  { q: 'What is your return policy?', a: 'We accept returns within 7 days of delivery. Items must be unused, unwashed, and have all original tags attached. Customized or clearance items are not eligible.' },
  { q: 'How do I initiate a return?', a: 'You can initiate a return from the "My Orders" section in your account. Select the item you wish to return and choose a reason. Our courier partner will pick it up within 24-48 hours.' },
  { q: 'When will I get my refund?', a: 'Once we receive and inspect the returned item, we will process the refund within 3-5 business days. It may take an additional 5-7 days to reflect in your bank account.' },
  { q: 'How do I find my size?', a: 'Each product page features a detailed size guide. We recommend measuring yourself and comparing with our size chart. If you are between sizes, we suggest sizing up.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards, UPI, net banking, and popular mobile wallets via Razorpay. All payments are processed securely online.' },
  { q: 'Is my payment information secure?', a: 'Yes. We use industry-standard encryption protocols and secure payment gateways (Razorpay) to ensure your payment information is 100% safe.' },
  { q: 'Why did my payment fail?', a: 'Payments can fail due to poor internet connection, bank server downtime, or incorrect details. If money was deducted, it will be automatically refunded within 5-7 business days.' },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default function FaqLayout({ children }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {children}
    </>
  );
}
