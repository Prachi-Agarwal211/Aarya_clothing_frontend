import { Metadata } from 'next';
import Link from 'next/link';
import { Package, RotateCcw, Clock, AlertTriangle, CheckCircle, Truck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Return & Refund Policy | Aarya Clothing',
  description: 'Learn about our return and refund policy. We accept returns only for damaged or defective products within 3 days of delivery.',
  keywords: 'return policy, refund policy, exchange policy, returns, refunds, Aarya Clothing',
  robots: 'index, follow',
};

export default function ReturnRefundPolicyPage() {
  return (
    <main className="min-h-screen py-12 sm:py-16 md:py-20 relative z-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B76E79]/20 mb-6">
            <RotateCcw className="w-8 h-8 text-[#F2C29A]" />
          </div>
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#F2C29A] mb-4"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Return & Refund Policy
          </h1>
          <p className="text-[#EAE0D5]/70 text-sm sm:text-base max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content Container */}
        <div className="relative rounded-3xl p-6 sm:p-8 md:p-12 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          
          {/* Important Notice */}
          <section className="mb-10">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#F2C29A]/15 to-[#B76E79]/10 border border-[#F2C29A]/25">
              <div className="flex items-start gap-4 mb-4">
                <AlertTriangle className="w-6 h-6 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <h2 className="text-xl text-[#EAE0D5] font-medium" style={{ fontFamily: 'Cinzel, serif' }}>
                  Important: Our Return Policy
                </h2>
              </div>
              <p className="text-[#EAE0D5]/80 leading-relaxed mb-4">
                At Aarya Clothing, we take great pride in the quality of our products. Due to the premium nature 
                of our items and hygiene considerations, <strong className="text-[#F2C29A]">we do not accept returns</strong> for 
                change of mind, size issues, or color preferences.
              </p>
              <p className="text-[#EAE0D5]/80 leading-relaxed">
                We only accept returns and exchanges for products that are <strong className="text-[#F2C29A]">damaged, defective, 
                or incorrect</strong> upon delivery. Please read this policy carefully before making a purchase.
              </p>
            </div>
          </section>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <CheckCircle className="w-6 h-6 text-[#F2C29A]" />
              Eligible Returns
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>We accept returns only under the following circumstances:</p>
              <ul className="space-y-3 ml-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#F2C29A]">✓</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Damaged Products:</strong>
                    <p>Items that arrive with visible damage, tears, stains, or manufacturing defects</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#F2C29A]">✓</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Defective Products:</strong>
                    <p>Items with functional issues, faulty zippers, broken embellishments, or poor stitching</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#F2C29A]">✓</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Wrong Product:</strong>
                    <p>Items that do not match your order (wrong design, color, size, or product)</p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Clock className="w-6 h-6 text-[#F2C29A]" />
              Return Timeframe
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <div className="p-5 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <p className="text-[#EAE0D5] leading-relaxed">
                  <strong className="text-[#F2C29A] text-lg">3-Day Window:</strong> You must report any issues and 
                  initiate a return request within <strong className="text-[#F2C29A]">3 days (72 hours)</strong> of 
                  receiving your order. Returns requested after this period will not be accepted.
                </p>
              </div>
              <p>
                The return window begins from the date of delivery as shown in the tracking information. We 
                recommend inspecting your items immediately upon delivery to ensure you can report any issues 
                within the specified timeframe.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Package className="w-6 h-6 text-[#F2C29A]" />
              Non-Returnable Items
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>The following items cannot be returned or exchanged under any circumstances:</p>
              <ul className="space-y-3 ml-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#B76E79]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#B76E79]">✕</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Sale Items:</strong>
                    <p>Products purchased during clearance sales, flash sales, or with discount codes above 30%</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#B76E79]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#B76E79]">✕</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Customized Products:</strong>
                    <p>Made-to-order items, personalized garments, or altered products</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#B76E79]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#B76E79]">✕</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Intimates & Innerwear:</strong>
                    <p>For hygiene reasons, blouses, innerwear, and similar items cannot be returned</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#B76E79]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#B76E79]">✕</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Used or Washed Items:</strong>
                    <p>Products that show signs of wear, have been washed, or altered in any way</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#B76E79]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#B76E79]">✕</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Accessories:</strong>
                    <p>Jewelry, belts, and other accessories unless defective upon arrival</p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <RotateCcw className="w-6 h-6 text-[#F2C29A]" />
              Exchange Process
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>If you receive a damaged, defective, or incorrect product, follow these steps:</p>
              
              <div className="space-y-4 mt-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#F2C29A]/20 border border-[#F2C29A]/30 flex items-center justify-center text-[#F2C29A] font-medium">
                      1
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Contact Customer Support</h3>
                    <p className="text-sm">
                      Email us at <span className="text-[#F2C29A]">support@aaryaclothing.com</span> within 3 days 
                      of delivery. Include your order number, product details, and clear photographs/videos 
                      showing the issue.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#F2C29A]/20 border border-[#F2C29A]/30 flex items-center justify-center text-[#F2C29A] font-medium">
                      2
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Quality Check Approval</h3>
                    <p className="text-sm">
                      Our quality team will review your request within 24-48 hours. If approved, we will send 
                      you a return authorization email with detailed instructions and a prepaid return label.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#F2C29A]/20 border border-[#F2C29A]/30 flex items-center justify-center text-[#F2C29A] font-medium">
                      3
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Pack and Ship</h3>
                    <p className="text-sm">
                      Pack the item securely in its original packaging with all tags, labels, and accessories 
                      intact. Attach the return label and drop off at the designated courier partner.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#F2C29A]/20 border border-[#F2C29A]/30 flex items-center justify-center text-[#F2C29A] font-medium">
                      4
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Exchange Processing</h3>
                    <p className="text-sm">
                      Once we receive and inspect the returned item, we will dispatch your exchange product. 
                      If the desired item is unavailable, we will issue a store credit or refund.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Truck className="w-6 h-6 text-[#F2C29A]" />
              Return Shipping
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <div className="p-5 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <p className="text-[#EAE0D5] leading-relaxed">
                  <strong className="text-[#F2C29A]">Free Return Shipping:</strong> For approved returns (damaged, 
                  defective, or wrong items), we provide a <strong className="text-[#F2C29A]">prepaid return label</strong> at 
                  no cost to you.
                </p>
              </div>
              <p>
                For returns that do not meet our policy criteria, return shipping costs will be borne by the 
                customer and deducted from the refund amount. We recommend using a trackable shipping service 
                and purchasing shipping insurance for valuable items.
              </p>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                <AlertTriangle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  We are not responsible for lost or damaged return shipments. Please retain your tracking 
                  information until your return is processed.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <CheckCircle className="w-6 h-6 text-[#F2C29A]" />
              Quality Check Process
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                All returned items undergo a thorough quality inspection at our facility before any exchange 
                or refund is processed:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Verification of product condition and authenticity</li>
                <li>Confirmation that all tags and packaging are intact</li>
                <li>Assessment of the reported issue or defect</li>
                <li>Check for signs of use, wear, or damage caused by customer</li>
              </ul>
              <p>
                If the returned item does not meet our return criteria, it will be sent back to you at your 
                expense, and no refund or exchange will be issued.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Clock className="w-6 h-6 text-[#F2C29A]" />
              Refund Timeline
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>Once your return is approved and processed:</p>
              <div className="space-y-3 mt-4">
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Refund Processing:</strong> 3-5 business days after return approval
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Bank Processing:</strong> 5-10 business days (varies by bank)
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Total Time:</strong> 8-15 business days from return receipt
                  </p>
                </div>
              </div>
              <p>
                Refunds are issued to the original payment method used for the purchase. For Cash on Delivery 
                (COD) orders, refunds will be processed via bank transfer. You will need to provide your bank 
                account details for COD refunds.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Package className="w-6 h-6 text-[#F2C29A]" />
              Store Credit
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                In some cases, we may issue store credit instead of a refund:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>When the exact replacement item is unavailable</li>
                <li>For minor issues where customer prefers credit over return</li>
                <li>For sale items where refunds are not applicable</li>
              </ul>
              <p>
                Store credit is valid for <strong className="text-[#F2C29A]">12 months</strong> from the date of issue and can 
                be used for any purchase on our website. Store credit is non-transferable and cannot be 
                redeemed for cash.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <AlertTriangle className="w-6 h-6 text-[#F2C29A]" />
              Damaged in Transit
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                If your package arrives damaged due to shipping:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Take photos of the damaged package before opening</li>
                <li>Document the damage to the product with clear photos</li>
                <li>Contact us within 24 hours of delivery</li>
                <li>Keep all packaging materials for inspection</li>
              </ul>
              <p>
                We will file a claim with the courier and arrange for a replacement or refund at no cost to you.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <CheckCircle className="w-6 h-6 text-[#F2C29A]" />
              Contact Us
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                For any questions about our Return & Refund Policy or to initiate a return, please contact us:
              </p>
              <div className="p-6 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 space-y-3">
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Email:</strong> returns@aaryaclothing.com
                </p>
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Customer Support:</strong> support@aaryaclothing.com
                </p>
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Phone:</strong> +91-XXXXXXXXXX
                </p>
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Hours:</strong> Monday - Saturday, 10 AM - 7 PM IST
                </p>
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
