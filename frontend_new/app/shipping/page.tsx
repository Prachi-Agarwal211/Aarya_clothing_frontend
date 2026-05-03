import type { Metadata } from 'next';
import Link from 'next/link';
import { Truck, Clock, MapPin, Package, DollarSign, Headphones, AlertCircle, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Shipping Policy | Aarya Clothing',
  description: 'Learn about our shipping options, delivery times, and shipping costs. Free shipping on orders above ₹999 across India.',
  keywords: 'shipping policy, delivery, shipping cost, free shipping, order tracking, Aarya Clothing',
  robots: 'index, follow',
  alternates: { canonical: 'https://aaryaclothing.in/shipping' },
};

const howToJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Track Your Aarya Clothing Order',
  description: 'Step-by-step guide to tracking your order after placing it at Aarya Clothing.',
  step: [
    { '@type': 'HowToStep', position: 1, name: 'Place your order', text: 'Complete your purchase on aaryaclothing.in. You will receive an order confirmation email immediately.' },
    { '@type': 'HowToStep', position: 2, name: 'Order processing', text: 'Your order is processed and packed within 1–2 business days.' },
    { '@type': 'HowToStep', position: 3, name: 'Dispatch & tracking', text: 'Once dispatched, you receive a shipping confirmation email with a tracking link.' },
    { '@type': 'HowToStep', position: 4, name: 'Track your shipment', text: 'Click the tracking link in your email, or visit the My Orders section in your account to track in real time.' },
    { '@type': 'HowToStep', position: 5, name: 'Delivery', text: 'Standard delivery takes 3–5 business days across India. Express delivery takes 1–2 business days for select pincodes.' },
  ],
};

export default function ShippingPolicyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
    <main className="min-h-screen py-12 sm:py-16 md:py-20 relative z-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B76E79]/20 mb-6">
            <Truck className="w-8 h-8 text-[#F2C29A]" />
          </div>
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#F2C29A] mb-4"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Shipping Policy
          </h1>
          <p className="text-[#EAE0D5]/70 text-sm sm:text-base max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content Container */}
        <div className="relative rounded-3xl p-6 sm:p-8 md:p-12 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          
          {/* Free Shipping Banner */}
          <section className="mb-10">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#F2C29A]/15 to-[#B76E79]/10 border border-[#F2C29A]/25">
              <div className="flex items-center justify-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-[#F2C29A]" />
                <h2 className="text-xl text-[#EAE0D5] font-medium" style={{ fontFamily: 'Cinzel, serif' }}>
                  Free Shipping Across India
                </h2>
              </div>
              <p className="text-[#EAE0D5]/80 leading-relaxed text-center">
                Enjoy <strong className="text-[#F2C29A]">free shipping on all orders</strong>. 
                No minimum order value required.
              </p>
            </div>
          </section>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <MapPin className="w-6 h-6 text-[#F2C29A]" />
              Shipping Areas
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                We ship to <strong className="text-[#F2C29A]">all locations across India</strong>, including:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                {[
                  'Metro Cities',
                  'Tier 1 Cities',
                  'Tier 2 Cities',
                  'Tier 3 Towns',
                  'Rural Areas',
                  'Remote Locations'
                ].map((area) => (
                  <div key={area} className="p-3 rounded-lg bg-[#F2C29A]/5 border border-[#F2C29A]/10 text-center">
                    <p className="text-sm text-[#EAE0D5]">{area}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                We currently do not offer international shipping. All shipments are within India only.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Clock className="w-6 h-6 text-[#F2C29A]" />
              Processing Time
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <div className="p-5 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <p className="text-[#EAE0D5] leading-relaxed">
                  <strong className="text-[#F2C29A]">10-15 Business Days:</strong> All orders are processed and 
                  dispatched within 10-15 business days (excluding weekends and public holidays) after payment 
                  confirmation.
                </p>
              </div>
              <p>
                During peak seasons, festivals, or sale periods, processing time may extend by a few additional days. 
                You will receive an email notification once your order has been dispatched with tracking information.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Truck className="w-6 h-6 text-[#F2C29A]" />
              Delivery Time
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                After dispatch, delivery times vary based on your location:
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 flex justify-between items-center">
                  <div>
                    <p className="text-[#EAE0D5] font-medium">Metro Cities</p>
                    <p className="text-xs text-[#EAE0D5]/60">Delhi, Mumbai, Bangalore, Chennai, Hyderabad, etc.</p>
                  </div>
                  <p className="text-[#F2C29A] font-medium">2-4 Business Days</p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 flex justify-between items-center">
                  <div>
                    <p className="text-[#EAE0D5] font-medium">Tier 1 & 2 Cities</p>
                    <p className="text-xs text-[#EAE0D5]/60">Major cities and state capitals</p>
                  </div>
                  <p className="text-[#F2C29A] font-medium">3-5 Business Days</p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 flex justify-between items-center">
                  <div>
                    <p className="text-[#EAE0D5] font-medium">Tier 3 Cities & Towns</p>
                    <p className="text-xs text-[#EAE0D5]/60">Smaller towns and rural areas</p>
                  </div>
                  <p className="text-[#F2C29A] font-medium">5-7 Business Days</p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 flex justify-between items-center">
                  <div>
                    <p className="text-[#EAE0D5] font-medium">Remote Locations</p>
                    <p className="text-xs text-[#EAE0D5]/60">North East, J&K, Ladakh, etc.</p>
                  </div>
                  <p className="text-[#F2C29A] font-medium">7-10 Business Days</p>
                </div>
              </div>

              <p className="text-sm">
                <strong className="text-[#EAE0D5]">Total Delivery Time:</strong> 3-7 business days (processing + shipping) 
                for most locations. Remote areas may take up to 10-12 business days.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <DollarSign className="w-6 h-6 text-[#F2C29A]" />
              Shipping Costs
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <div className="p-5 rounded-xl bg-gradient-to-br from-[#F2C29A]/15 to-[#F2C29A]/5 border border-[#F2C29A]/25">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-[#F2C29A]" />
                    <h3 className="text-[#EAE0D5] font-medium">All Orders</h3>
                  </div>
                  <p className="text-3xl text-[#F2C29A] font-semibold mb-2">FREE</p>
                  <p className="text-xs text-[#EAE0D5]/60">Free shipping on all orders</p>
                </div>
              
              <p className="text-sm">
                Shipping charges are calculated at checkout based on your order value. The shipping fee is 
                waived automatically for eligible orders. No hidden charges or additional fees.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Package className="w-6 h-6 text-[#F2C29A]" />
              Order Tracking
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                Once your order is dispatched, you will receive:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Email notification with tracking number and courier details</li>
                <li>SMS with tracking link to your registered mobile number</li>
                <li>Access to tracking information in your account dashboard</li>
              </ul>
              <p>
                You can track your order by clicking the tracking link or visiting the courier partner's 
                website and entering your tracking number.
              </p>
              <div className="p-5 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20 mt-4">
                <p className="text-[#EAE0D5] text-sm">
                  <strong className="text-[#F2C29A]">Pro Tip:</strong> Save your tracking number for easy reference. 
                  You can also contact our customer support team with your order number for tracking assistance.
                </p>
              </div>
            </div>
          </section>


          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <AlertCircle className="w-6 h-6 text-[#F2C29A]" />
              Return Process
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                For customers who wish to return products, please follow our video-based return process:
              </p>
              <div className="space-y-3 mt-4">
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Step 1 - Create Unboxing Video:</strong> 
                    Record a video showing the sealed package, unboxing process, and product condition
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Step 2 - Upload Video:</strong> 
                    Submit your return request with the unboxing video within 7 days of delivery
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Step 3 - Review Process:</strong> 
                    Our team will review your video and accept or reject the return request based on evidence
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <p className="text-sm text-[#EAE0D5]">
                    <strong className="text-[#F2C29A]">Step 4 - Product Return:</strong> 
                    If approved, ship the product back to us for exchange or refund processing
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 mt-4">
                <AlertCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  Unboxing videos are mandatory for all return requests. Returns without proper video evidence 
                  will not be accepted. Ensure videos clearly show product condition and any issues.
                </p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <AlertCircle className="w-6 h-6 text-[#F2C29A]" />
              Undelivered Packages
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                If your package remains undelivered after 3 attempts:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The package will be returned to our warehouse</li>
                <li>You will be notified via email and SMS</li>
                <li>We will contact you to confirm if you want a reshipment or refund</li>
              </ul>
              <div className="p-5 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20 mt-4">
                <p className="text-[#EAE0D5] text-sm">
                  <strong className="text-[#F2C29A]">Reshipment:</strong> If you request reshipment, we will dispatch 
                  your order again at no additional cost. If you prefer a refund, it will be processed within 
                  5-7 business days after we receive the returned package.
                </p>
              </div>
            </div>
          </section>


          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <AlertCircle className="w-6 h-6 text-[#F2C29A]" />
              Delivery Issues
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                If you experience any delivery issues:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Delayed Delivery:</strong> Contact us if your order is delayed beyond the estimated time</li>
                <li><strong>Wrong Address:</strong> Contact customer support immediately to update delivery address (before dispatch)</li>
                <li><strong>Damaged Package:</strong> Do not accept visibly damaged packages; contact us immediately</li>
                <li><strong>Lost Package:</strong> Report immediately if tracking shows delivered but you haven&apos;t received it</li>
              </ul>
              <p>
                Our customer support team will work with the courier partner to resolve the issue promptly.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <Headphones className="w-6 h-6 text-[#F2C29A]" />
              Contact Us
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                For any shipping-related queries or concerns, please contact us:
              </p>
              <div className="p-6 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 space-y-3">
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
    </>
  );
}
