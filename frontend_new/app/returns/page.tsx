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
                  Easy Returns - We're Here to Help!
                </h2>
              </div>
              <p className="text-[#EAE0D5]/80 leading-relaxed mb-4">
                At Aarya Clothing, we want you to love your purchase. If you're not completely satisfied, 
                we make it easy to return or exchange your items. We accept returns within <strong className="text-[#F2C29A]">7 days 
                of delivery</strong> for any reason.
              </p>
              <p className="text-[#EAE0D5]/80 leading-relaxed">
                Simply submit a return request, and our team will guide you through the process. If we need any additional 
                information, we'll reach out to you. Your satisfaction is our priority!
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
                  <strong className="text-[#F2C29A] text-lg">7-Day Window:</strong> You must report any issues and 
                  initiate a return request within <strong className="text-[#F2C29A]">7 days</strong> of 
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
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Create Unboxing Video</h3>
                    <p className="text-sm">
                      When you receive your package, create a clear video showing:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>The sealed package before opening</li>
                      <li>The unboxing process in good lighting</li>
                      <li>The product condition and any defects/issues</li>
                      <li>All items, tags, and packaging materials</li>
                    </ul>
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
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Submit Return Request</h3>
                    <p className="text-sm">
                      Email us at <span className="text-[#F2C29A]">support@aaryaclothing.com</span> within 7 days 
                      of delivery. Include your order number, product details, and upload the unboxing video 
                      showing the issue clearly.
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
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Review & Approval</h3>
                    <p className="text-sm">
                      Our team will review your video and request within 24-48 hours. Return requests will be 
                      accepted or rejected based on the video evidence. If approved, we will send you a return 
                      authorization email with detailed instructions and a prepaid return label.
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
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Product Return & Exchange</h3>
                    <p className="text-sm">
                      Pack the item securely in its original packaging with all tags intact. Attach the return 
                      label and ship back to us. Once we receive and verify the returned product, we will dispatch 
                      your exchange item or process a refund.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 mt-6">
                <AlertTriangle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  <strong className="text-[#F2C29A]">Important:</strong> Unboxing videos are mandatory for all return requests. 
                  Returns without proper video evidence will not be accepted. Make sure the video clearly shows 
                  the product condition and any issues you're reporting.
                </p>
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
                    <strong className="text-[#F2C29A]">Refund Processing:</strong> 3-7 business days after return approval
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Bank Processing:</strong> 7-12 business days (varies by bank)
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Total Time:</strong> 8-15 business days from return receipt
                  </p>
                </div>
              </div>
              <p>
                Refunds are issued to the original payment method used for the purchase. All refunds are processed within 5-7 business days after the return is verified.
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
                  <strong className="text-[#F2C29A]">Customer Support:</strong> support@aaryaclothing.com
                </p>
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Phone:</strong> +91-XXXXXXXXXX
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
