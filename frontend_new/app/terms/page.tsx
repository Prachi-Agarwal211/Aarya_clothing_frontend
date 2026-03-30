import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, CheckCircle, AlertCircle, Scale } from 'lucide-react';
import { generateArticleSchema, generateBreadcrumbSchema } from '@/lib/structuredData';

const LAST_MODIFIED = '2024-01-15';

// SEO Metadata
export const metadata: Metadata = {
  title: 'Terms of Service | Aarya Clothing - Legal Agreement',
  description: 'Read our terms of service for Aarya Clothing. Learn about your rights, responsibilities, and our policies for using our e-commerce platform.',
  keywords: ['terms of service', 'terms and conditions', 'legal agreement', 'e-commerce terms', 'Aarya Clothing', 'user agreement'],
  authors: [{ name: 'Aarya Clothing' }],
  creator: 'Aarya Clothing',
  publisher: 'Aarya Clothing',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://aaryaclothing.in/terms' },
  openGraph: {
    title: 'Terms of Service | Aarya Clothing',
    description: 'Read our terms of service and understand your rights and responsibilities.',
    url: 'https://aaryaclothing.in/terms',
    type: 'article',
    publishedTime: '2020-01-01',
    modifiedTime: LAST_MODIFIED,
    images: [{ url: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png', width: 1200, height: 630, alt: 'Aarya Clothing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service | Aarya Clothing',
    description: 'Read our terms of service and understand your rights and responsibilities.',
    images: ['https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png'],
  },
};

// Generate structured data
function generateStructuredData() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Terms of Service', url: '/terms' }
  ]);

  const articleSchema = generateArticleSchema({
    title: 'Terms of Service',
    description: 'Read our terms of service for Aarya Clothing.',
    url: 'https://aaryaclothing.in/terms',
    datePublished: '2020-01-01',
    dateModified: LAST_MODIFIED,
    articleBody: 'Welcome to Aarya Clothing. These Terms of Service govern your access to and use of our website, products, and services.',
  });

  return {
    breadcrumbSchema,
    articleSchema
  };
}

export default function TermsOfServicePage() {
  const { breadcrumbSchema, articleSchema } = generateStructuredData();

  return (
    <main className="min-h-screen py-12 sm:py-16 md:py-20 relative z-10" role="main" aria-label="Terms of Service">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        key="breadcrumb-schema"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        key="article-schema"
      />

      <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B76E79]/20 mb-6">
            <Scale className="w-8 h-8 text-[#F2C29A]" />
          </div>
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#F2C29A] mb-4"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Terms of Service
          </h1>
          <p className="text-[#EAE0D5]/70 text-sm sm:text-base max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content Container */}
        <div className="relative rounded-3xl p-6 sm:p-8 md:p-12 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          
          {/* Introduction */}
          <section className="mb-10">
            <p className="text-[#EAE0D5]/80 leading-relaxed mb-6">
              Welcome to Aarya Clothing. These Terms of Service ("Terms") govern your access to and use of our website, 
              products, and services. By accessing or using our platform, you agree to be bound by these Terms. 
              Please read them carefully before making any purchase.
            </p>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
              <AlertCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#EAE0D5]/70">
                If you do not agree with any part of these terms, please do not use our website or purchase our products.
              </p>
            </div>
          </section>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">1</span>
              Acceptance of Terms
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                By accessing, browsing, or using this website, you acknowledge that you have read, understood, and agree 
                to be bound by these Terms of Service and to comply with all applicable laws and regulations. You also 
                agree that you are solely responsible for your conduct while using our services.
              </p>
              <p>
                We reserve the right to modify these terms at any time without prior notice. Your continued use of the 
                website after any changes constitutes acceptance of the new terms. It is your responsibility to review 
                these terms periodically for updates.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">2</span>
              Product Information
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                We strive to provide accurate and up-to-date product information, including descriptions, images, 
                pricing, and availability. However, we do not warrant that product descriptions, images, or other 
                content on this website are accurate, complete, reliable, current, or error-free.
              </p>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                <CheckCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  Product colors may vary slightly from images shown due to monitor settings and photography lighting. 
                  We recommend checking product measurements and fabric details before purchasing.
                </p>
              </div>
              <p>
                All products are subject to availability. We reserve the right to discontinue any product at any time 
                without notice. We cannot guarantee that any product or service will be available indefinitely.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">3</span>
              Pricing &amp; No Hidden Charges
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#EAE0D5] font-medium mb-1">Transparent Pricing — What You See Is What You Pay</p>
                  <p className="text-sm text-[#EAE0D5]/70">
                    All prices displayed on our website are in Indian Rupees (₹/INR) and are <strong className="text-[#EAE0D5]">fully inclusive of all taxes and shipping charges</strong>. There are no hidden fees, no surprise GST additions, and no shipping charges added at checkout.
                  </p>
                </div>
              </div>
              <p>
                The price you see on the product page is the exact amount you will be charged. Applicable taxes are
                already included in the displayed price.
              </p>
              <p>
                In the event of a pricing error, we reserve the right to cancel any orders placed at the incorrect 
                price. We will notify you and provide the option to reconfirm at the correct price or cancel.
              </p>
            </div>
          </section>

          {/* Section 3b — Payment Policy */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">4</span>
              Payment Policy — Online Payments Only
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                At Aarya Clothing, we accept <strong className="text-[#EAE0D5]">online payments only</strong> through our secure payment gateway. All orders must be paid in full at checkout using Razorpay. We accept UPI, credit/debit cards, net banking, and digital wallets.
              </p>
              <p>
                Payments are processed securely via Razorpay. Your payment information is encrypted and never stored on our servers.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">5</span>
              Order Acceptance
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                Your placement of an order represents an offer to purchase from us. All orders are subject to 
                acceptance and availability. We reserve the right to refuse or cancel any order for any reason, 
                including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Unavailability of products ordered</li>
                <li>Errors in product description or pricing</li>
                <li>Suspected fraud or unauthorized use of payment methods</li>
                <li>Violation of our terms or policies</li>
                <li>Technical or system errors</li>
              </ul>
              <p>
                We will notify you via email or phone if we need to cancel your order and will process a full 
                refund if payment has already been received.
              </p>
            </div>
          </section>

          {/* Return Policy Section */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">6</span>
              Returns &amp; Refund Policy
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>We accept returns <strong className="text-[#EAE0D5]">only for defective or damaged items</strong>. We do not accept returns for change of mind, size issues, or any reason other than a manufacturing defect or damage during shipping.</p>
              <div className="p-4 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/20 space-y-2">
                <p className="text-[#EAE0D5] font-medium">Mandatory Video Proof Requirement</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>A video recording of the <strong className="text-[#EAE0D5]">unboxing of the package</strong> is mandatory for all return requests</li>
                  <li>The video must be recorded continuously from before opening the sealed package to revealing the product</li>
                  <li>The defect or damage must be clearly visible in the video</li>
                  <li>Returns submitted without a valid unboxing video will be automatically rejected</li>
                </ul>
              </div>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Return requests must be submitted within <strong className="text-[#EAE0D5]">7 days</strong> of delivery</li>
                <li>Approved refunds are processed within 5–7 business days to the original payment method</li>
                <li>Items must be unused and in their original packaging</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">7</span>
              User Account Responsibilities
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                To make purchases on our website, you may be required to create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Providing accurate, current, and complete information during registration</li>
                <li>Updating your account information to keep it accurate and complete</li>
                <li>Notifying us immediately of any unauthorized use of your account</li>
              </ul>
              <p>
                We reserve the right to suspend or terminate accounts that we believe are being used in violation 
                of these terms or for any fraudulent activity.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">6</span>
              Prohibited Uses
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                You agree not to use our website or services for any purpose that is unlawful or prohibited by these 
                terms. You may not use our services in any way that could:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Interfere with or disrupt the integrity or performance of the website</li>
                <li>Attempt to gain unauthorized access to our systems or data</li>
                <li>Use automated systems (bots, scrapers) to access the website without permission</li>
                <li>Transmit malware, viruses, or any harmful code</li>
                <li>Impersonate any person or entity or misrepresent your affiliation</li>
                <li>Harvest or collect information about other users without consent</li>
                <li>Use the website for any illegal purpose or in violation of any laws</li>
              </ul>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">7</span>
              Limitation of Liability
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                To the maximum extent permitted by applicable law, Aarya Clothing shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether 
                incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
              </p>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <Shield className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  Our total liability to you for any claim arising out of or relating to these terms or your use of 
                  our services shall not exceed the amount you paid to us for the products or services giving rise 
                  to the claim.
                </p>
              </div>
              <p>
                We are not responsible for any delays or failures in performance resulting from causes beyond our 
                reasonable control, including but not limited to natural disasters, war, terrorism, riots, 
                embargoes, acts of civil or military authorities, fire, floods, accidents, strikes, or shortages 
                of transportation, facilities, fuel, energy, labor, or materials.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">8</span>
              Intellectual Property
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                All content on this website, including but not limited to text, graphics, logos, images, audio clips, 
                digital downloads, and software, is the property of Aarya Clothing or its content suppliers and is 
                protected by Indian and international intellectual property laws.
              </p>
              <p>
                You are granted a limited, non-exclusive, non-transferable, revocable license to access and use this 
                website for personal, non-commercial purposes. You may not reproduce, distribute, modify, create 
                derivative works of, publicly display, or commercially exploit any content from this website without 
                our express written permission.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">9</span>
              Governing Law and Jurisdiction
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                These Terms of Service shall be governed by and construed in accordance with the laws of India, 
                without regard to its conflict of law provisions. Any disputes arising out of or relating to these 
                terms or your use of our services shall be subject to the exclusive jurisdiction of the courts 
                located in India.
              </p>
              <p>
                If any provision of these terms is found to be unlawful, void, or unenforceable, that provision 
                shall be deemed severable from these terms and shall not affect the validity and enforceability 
                of any remaining provisions.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">10</span>
              Contact Information
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>
                For any questions, concerns, or requests regarding these Terms of Service, please contact us:
              </p>
              <div className="p-6 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                <p className="text-[#EAE0D5] mb-2"><strong>Email:</strong> support@aaryaclothing.com</p>
                <p className="text-[#EAE0D5] mb-2"><strong>Phone:</strong> +91-XXXXXXXXXX</p>
                <p className="text-[#EAE0D5]"><strong>Address:</strong> [Registered Office Address], India</p>
              </div>
            </div>
          </section>

          {/* Back to Top */}
          <div className="pt-8 border-t border-[#B76E79]/15">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 text-[#F2C29A] hover:text-[#EAE0D5] transition-colors text-sm"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
