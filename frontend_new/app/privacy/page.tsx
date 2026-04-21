import { Metadata } from 'next';
import Link from 'next/link';
import { Lock, Eye, Shield, UserCheck, Cookie, Mail, Database, Globe, RotateCcw, Video } from 'lucide-react';
import { generateArticleSchema, generateBreadcrumbSchema } from '@/lib/structuredData';

const LAST_MODIFIED = '2024-01-15';

// SEO Metadata
export const metadata: Metadata = {
  title: 'Privacy Policy | Aarya Clothing - Data Protection & Privacy',
  description: 'Learn how Aarya Clothing collects, uses, and protects your personal information. Your privacy is our priority. GDPR compliant data protection.',
  keywords: ['privacy policy', 'data protection', 'GDPR', 'personal information', 'data security', 'Aarya Clothing', 'privacy rights'],
  authors: [{ name: 'Aarya Clothing' }],
  creator: 'Aarya Clothing',
  publisher: 'Aarya Clothing',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://aaryaclothing.in/privacy' },
  openGraph: {
    title: 'Privacy Policy | Aarya Clothing',
    description: 'Learn how we protect your personal information and respect your privacy rights.',
    url: 'https://aaryaclothing.in/privacy',
    type: 'article',
    publishedTime: '2020-01-01',
    modifiedTime: LAST_MODIFIED,
    images: [{ url: 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png', width: 1200, height: 630, alt: 'Aarya Clothing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy | Aarya Clothing',
    description: 'Learn how we protect your personal information and respect your privacy rights.',
    images: ['https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png'],
  },
};

// Generate structured data
function generateStructuredData() {
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Privacy Policy', url: '/privacy' }
  ]);

  const articleSchema = generateArticleSchema({
    title: 'Privacy Policy',
    description: 'Learn how Aarya Clothing collects, uses, and protects your personal information.',
    url: 'https://aaryaclothing.in/privacy',
    datePublished: '2020-01-01',
    dateModified: LAST_MODIFIED,
    articleBody: 'At Aarya Clothing, we are committed to protecting your privacy and ensuring the security of your personal information.',
  });

  return {
    breadcrumbSchema,
    articleSchema
  };
}

export default function PrivacyPolicyPage() {
  const { breadcrumbSchema, articleSchema } = generateStructuredData();

  return (
    <main className="min-h-screen py-12 sm:py-16 md:py-20 relative z-10" role="main" aria-label="Privacy Policy">
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
            <Lock className="w-8 h-8 text-[#F2C29A]" />
          </div>
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#F2C29A] mb-4"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Privacy Policy
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
              At Aarya Clothing, we are committed to protecting your privacy and ensuring the security of your 
              personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard 
              your information when you visit our website or make purchases from us.
            </p>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
              <Shield className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#EAE0D5]/70">
                We comply with applicable data protection laws, including the General Data Protection Regulation (GDPR) 
                and the Information Technology Act, 2000 of India.
              </p>
            </div>
          </section>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Eye className="w-6 h-6 text-[#F2C29A]" />
              Information We Collect
            </h2>
            <div className="space-y-6 text-[#EAE0D5]/70 leading-relaxed pl-4">
              
              <div>
                <h3 className="text-[#EAE0D5] font-medium mb-2">Personal Information</h3>
                <p className="mb-3">
                  When you create an account, place an order, or interact with our website, we may collect the 
                  following personal information:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Name and contact information (email address, phone number)</li>
                  <li>Billing and shipping addresses</li>
                  <li>Payment information (credit/debit card details, UPI ID)</li>
                  <li>Account credentials (username and password)</li>
                  <li>Order history and preferences</li>
                  <li>Communication preferences</li>
                </ul>
              </div>

              <div>
                <h3 className="text-[#EAE0D5] font-medium mb-2">Automatically Collected Information</h3>
                <p className="mb-3">
                  When you visit our website, we automatically collect certain information about your device and 
                  browsing activity:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>IP address and browser type</li>
                  <li>Device information (operating system, device model)</li>
                  <li>Pages visited and time spent on pages</li>
                  <li>Referring website or source</li>
                  <li>Clickstream data and browsing patterns</li>
                </ul>
              </div>

            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Database className="w-6 h-6 text-[#F2C29A]" />
              How We Use Your Information
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>We use the information we collect for the following purposes:</p>
              <ul className="list-disc list-inside space-y-3 ml-4">
                <li><strong>Order Processing:</strong> To process and fulfill your orders, including payment processing and shipping</li>
                <li><strong>Customer Service:</strong> To respond to your inquiries, provide support, and resolve issues</li>
                <li><strong>Account Management:</strong> To create and maintain your account, verify your identity</li>
                <li><strong>Communication:</strong> To send order confirmations, shipping updates, and important notices</li>
                <li><strong>Marketing:</strong> To send promotional communications (with your consent)</li>
                <li><strong>Website Improvement:</strong> To analyze usage patterns and improve our website functionality</li>
                <li><strong>Fraud Prevention:</strong> To detect and prevent fraudulent transactions and unauthorized access</li>
                <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Globe className="w-6 h-6 text-[#F2C29A]" />
              Data Sharing and Disclosure
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                We do not sell, trade, or rent your personal information to third parties. We may share your 
                information with the following categories of recipients:
              </p>
              <ul className="list-disc list-inside space-y-3 ml-4">
                <li>
                  <strong>Service Providers:</strong> Third-party vendors who perform services on our behalf, 
                  such as payment processors, shipping carriers, and IT service providers
                </li>
                <li>
                  <strong>Legal Authorities:</strong> When required by law, court order, or governmental regulation, 
                  or to protect our rights and safety
                </li>
                <li>
                  <strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, 
                  customer information may be transferred as part of the transaction
                </li>
                <li>
                  <strong>With Your Consent:</strong> We may share information with third parties when you explicitly 
                  consent to such sharing
                </li>
              </ul>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                <Shield className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  All third-party service providers are contractually obligated to protect your information and 
                  use it only for the purposes we specify.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Lock className="w-6 h-6 text-[#F2C29A]" />
              Data Security Measures
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                We implement appropriate technical and organizational measures to protect your personal information 
                against unauthorized access, alteration, disclosure, or destruction:
              </p>
              <ul className="list-disc list-inside space-y-3 ml-4">
                <li><strong>Encryption:</strong> All data transmitted between your browser and our servers is encrypted using SSL/TLS technology</li>
                <li><strong>Secure Storage:</strong> Personal information is stored on secure servers with restricted access</li>
                <li><strong>Payment Security:</strong> Payment information is processed through PCI-DSS compliant payment gateways</li>
                <li><strong>Access Controls:</strong> Employee access to personal data is restricted on a need-to-know basis</li>
                <li><strong>Regular Audits:</strong> We conduct regular security assessments and updates</li>
                <li><strong>Firewall Protection:</strong> Our systems are protected by advanced firewall technology</li>
              </ul>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <Lock className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  While we strive to protect your information, no method of transmission over the internet or 
                  electronic storage is 100% secure. We cannot guarantee absolute security.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <UserCheck className="w-6 h-6 text-[#F2C29A]" />
              Your Rights and Choices
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                Under applicable data protection laws, you have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside space-y-3 ml-4">
                <li>
                  <strong>Right to Access:</strong> You can request a copy of the personal information we hold about you
                </li>
                <li>
                  <strong>Right to Correction:</strong> You can request correction of inaccurate or incomplete information
                </li>
                <li>
                  <strong>Right to Deletion:</strong> You can request deletion of your personal information, subject to legal obligations
                </li>
                <li>
                  <strong>Facebook Data Deletion:</strong> If you have used Facebook to log in to our services, you can request the deletion of your data by contacting us or by removing the App via your Facebook Settings &amp; Privacy &gt; Apps and Websites.
                </li>
                <li>
                  <strong>Right to Restriction:</strong> You can request restriction of processing your personal information
                </li>
                <li>
                  <strong>Right to Data Portability:</strong> You can request transfer of your data to another service provider
                </li>
                <li>
                  <strong>Right to Object:</strong> You can object to processing of your personal information for certain purposes
                </li>
                <li>
                  <strong>Right to Withdraw Consent:</strong> You can withdraw consent at any time where processing is based on consent
                </li>
                <li>
                  <strong>Right to Opt-Out:</strong> You can opt-out of marketing communications at any time
                </li>
              </ul>
              <p>
                To exercise these rights, please contact us at{' '}
                <span className="text-[#F2C29A]">privacy@aaryaclothing.com</span>. We will respond to your request 
                within 30 days.
              </p>
            </div>
          </section>

          {/* Return Policy Section */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <RotateCcw className="w-6 h-6 text-[#F2C29A]" />
              Return & Refund Policy
            </h2>
            <div className="space-y-6 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                We want you to be completely satisfied with your purchase. If you're not happy with your order, 
                we offer a hassle-free return policy as outlined below.
              </p>

              <div className="space-y-4">
                <h3 className="text-[#EAE0D5] font-medium text-lg">Eligibility for Returns</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Returns are accepted for orders that have been delivered and show delivery confirmation</li>
                  <li>Returns must be initiated within 7 days of delivery</li>
                  <li>Items must be unused, unworn, and in original packaging with all tags attached</li>
                  <li>Personalized or custom-made items cannot be returned unless defective</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <div className="flex items-start gap-3">
                  <Video className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#EAE0D5] font-medium mb-1">Video Proof Required for All Returns</p>
                    <p className="text-sm">
                      To process your return, you must record a video while unboxing the product. This video must clearly show:
                    </p>
                    <ul className="list-disc list-inside space-y-1 mt-2 text-sm ml-2">
                      <li>The sealed package before opening</li>
                      <li>The unboxing process from start to finish</li>
                      <li>All sides of the product once removed from packaging</li>
                      <li>Any defects or issues if present</li>
                    </ul>
                    <p className="text-sm mt-2">
                      Upload this video along with your return request. Returns without video proof will not be processed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[#EAE0D5] font-medium text-lg">How to Submit a Return</h3>
                <ol className="list-decimal list-inside space-y-2 ml-4">
                  <li>Log into your account and go to "My Orders"</li>
                  <li>Select the order containing the item(s) you wish to return</li>
                  <li>Click "Request Return" and select the reason for return</li>
                  <li>Upload the required unboxing video (must be under 50MB)</li>
                  <li>Submit the return request</li>
                  <li>Our team will review your request within 2-3 business days</li>
                  <li>Once approved, we'll provide return shipping instructions</li>
                </ol>
              </div>

              <div className="space-y-4">
                <h3 className="text-[#EAE0D5] font-medium text-lg">Refund Process</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Refunds are processed within 5-7 business days after return is received and verified</li>
                  <li>Refunds are credited to your original payment method</li>
                  <li>Shipping charges are non-refundable unless the return is due to our error</li>
                  <li>Exchange orders will be shipped once the return is processed</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-300">
                  <strong>Note:</strong> Video proof is mandatory for ALL returns. This policy helps us ensure 
                  product quality and resolve any shipping-related issues promptly. Please record your unboxing 
                  video carefully before disposing of any packaging.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Cookie className="w-6 h-6 text-[#F2C29A]" />
              Cookies and Tracking Technologies
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                We use cookies and similar tracking technologies to enhance your browsing experience, analyze 
                website traffic, and personalize content. Cookies are small data files stored on your device 
                when you visit our website.
              </p>
              
              <div className="space-y-3">
                <h3 className="text-[#EAE0D5] font-medium">Types of Cookies We Use:</h3>
                <ul className="space-y-3 ml-4">
                  <li className="p-3 rounded-lg bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                    <strong className="text-[#EAE0D5]">Essential Cookies:</strong>
                    <p className="text-sm mt-1">Required for basic website functionality, such as adding items to cart and secure checkout</p>
                  </li>
                  <li className="p-3 rounded-lg bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                    <strong className="text-[#EAE0D5]">Performance Cookies:</strong>
                    <p className="text-sm mt-1">Help us understand how visitors interact with our website to improve performance</p>
                  </li>
                  <li className="p-3 rounded-lg bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                    <strong className="text-[#EAE0D5]">Functional Cookies:</strong>
                    <p className="text-sm mt-1">Remember your preferences and settings for a personalized experience</p>
                  </li>
                  <li className="p-3 rounded-lg bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                    <strong className="text-[#EAE0D5]">Marketing Cookies:</strong>
                    <p className="text-sm mt-1">Used to deliver relevant advertisements and track marketing campaign effectiveness</p>
                  </li>
                </ul>
              </div>

              <p>
                You can control cookie settings through your browser preferences. Most browsers allow you to 
                refuse or delete cookies. However, disabling certain cookies may affect website functionality.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Globe className="w-6 h-6 text-[#F2C29A]" />
              International Data Transfers
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                Your information may be transferred to and processed in countries other than your country of 
                residence. These countries may have data protection laws that are different from those of your 
                country.
              </p>
              <p>
                We ensure that appropriate safeguards are in place to protect your information during international 
                transfers, including standard contractual clauses and adherence to applicable data protection frameworks.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Mail className="w-6 h-6 text-[#F2C29A]" />
              Data Retention
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                We retain your personal information only for as long as necessary to fulfill the purposes outlined 
                in this Privacy Policy, unless a longer retention period is required by law.
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Account information: Retained while your account is active</li>
                <li>Order information: Retained for 7 years for tax and legal compliance</li>
                <li>Marketing data: Retained until you unsubscribe or request deletion</li>
                <li>Analytics data: Anonymized after 26 months</li>
              </ul>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Shield className="w-6 h-6 text-[#F2C29A]" />
              Children's Privacy
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                Our website is not intended for children under the age of 18. We do not knowingly collect personal 
                information from children. If you are a parent or guardian and believe your child has provided us 
                with personal information, please contact us immediately, and we will take steps to delete such 
                information.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Mail className="w-6 h-6 text-[#F2C29A]" />
              Changes to This Privacy Policy
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices, technology, 
                legal requirements, or other factors. When we make changes, we will update the "Last updated" date 
                at the top of this policy.
              </p>
              <p>
                We encourage you to review this Privacy Policy periodically. Significant changes will be communicated 
                through email notifications or prominent notices on our website.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Mail className="w-6 h-6 text-[#F2C29A]" />
              Contact Us
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, 
                please contact us:
              </p>
              <div className="p-6 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 space-y-3">
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Email:</strong> privacy@aaryaclothing.com
                </p>
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Data Protection Officer:</strong> dpo@aaryaclothing.com
                </p>
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Phone:</strong> +91 73001 86757
                </p>
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Address:</strong> 103/44 Meera Marg, Jaipur, Rajasthan 302020, India
                </p>
              </div>
              <p className="text-sm">
                For EU residents, you also have the right to lodge a complaint with your local data protection 
                authority if you believe we have violated applicable data protection laws.
              </p>
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
