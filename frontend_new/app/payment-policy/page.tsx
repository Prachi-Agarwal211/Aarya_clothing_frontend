import { Metadata } from 'next';
import Link from 'next/link';
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Payment Policy | Aarya Clothing',
  description: 'Learn about our payment policy at Aarya Clothing. Secure online payments via Razorpay — UPI, cards, net banking and wallets accepted.',
  keywords: 'payment policy, online payment, Razorpay, UPI, secure payment, Aarya Clothing',
  robots: 'index, follow',
};

export default function PaymentPolicyPage() {
  return (
    <main className="min-h-screen py-12 sm:py-16 md:py-20 relative z-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B76E79]/20 mb-6">
            <CreditCard className="w-8 h-8 text-[#F2C29A]" />
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#F2C29A] mb-4"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Payment Policy
          </h1>
          <p className="text-[#EAE0D5]/70 text-sm sm:text-base max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content Container */}
        <div className="relative rounded-3xl p-6 sm:p-8 md:p-12 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">1</span>
              Our Payment Approach
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>At Aarya Clothing, we accept <strong className="text-[#EAE0D5]">online payments only</strong> through our secure payment gateway. All orders must be paid in full at checkout.</p>

              <div className="grid sm:grid-cols-1 gap-3 mt-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#EAE0D5] font-medium mb-1">No Hidden Charges</p>
                    <p className="text-sm">The price you see is the price you pay. No additional processing fees, no convenience charges, no surprises at checkout.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#EAE0D5] font-medium mb-1">All Taxes Included</p>
                    <p className="text-sm">Every listed price is <strong>inclusive of all taxes</strong> (GST included). What you see is what you pay — nothing more.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#EAE0D5] font-medium mb-1">Free Shipping</p>
                    <p className="text-sm">We offer <strong>free shipping</strong> on all orders across India. No minimum order value required.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[#EAE0D5] font-medium mb-1">Reasonable Prices</p>
                    <p className="text-sm">We source directly from manufacturers and artisans to bring you <strong>premium ethnic wear at reasonable prices</strong>. No middlemen, no markups.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">2</span>
              Accepted Payment Methods
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>All payments are processed securely via <strong className="text-[#EAE0D5]">Razorpay</strong>, India&apos;s leading payment gateway. We accept:</p>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {[
                  { icon: '📱', label: 'UPI', desc: 'GPay, PhonePe, Paytm, BHIM & all UPI apps' },
                  { icon: '💳', label: 'Credit / Debit Cards', desc: 'Visa, Mastercard, RuPay, Amex' },
                  { icon: '🏦', label: 'Net Banking', desc: 'All major Indian banks supported' },
                  { icon: '👛', label: 'Digital Wallets', desc: 'Paytm, Mobikwik, and more' },
                ].map(m => (
                  <div key={m.label} className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                    <span className="text-2xl">{m.icon}</span>
                    <div>
                      <p className="text-[#EAE0D5] font-medium">{m.label}</p>
                      <p className="text-xs text-[#EAE0D5]/50">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">3</span>
              Payment Security
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>Your payment security is our highest priority.</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All transactions are <strong className="text-[#EAE0D5]">256-bit SSL encrypted</strong></li>
                <li>We never store your card or banking details on our servers</li>
                <li>Razorpay is PCI-DSS compliant and RBI-authorised</li>
                <li>3D Secure authentication for card payments</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">4</span>
              Refunds &amp; Failed Payments
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <p>If a payment fails or is charged but the order is not created, the amount will be automatically refunded to your original payment method within <strong className="text-[#EAE0D5]">5–7 business days</strong>.</p>
              <p>For approved returns, refunds are processed within 5–7 business days after the return is verified.</p>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <AlertCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm">If you face any payment issue, please contact <strong className="text-[#EAE0D5]">support@aaryaclothing.com</strong> with your order ID.</p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <span className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center text-sm text-[#F2C29A]">5</span>
              Contact Us
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-11">
              <div className="p-6 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                <p className="text-[#EAE0D5] mb-2"><strong>Email:</strong> support@aaryaclothing.com</p>
                <p className="text-[#EAE0D5] mb-2"><strong>Phone:</strong> +91-XXXXXXXXXX</p>
                <p className="text-[#EAE0D5]"><strong>Hours:</strong> Monday – Saturday, 10 AM – 7 PM IST</p>
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
