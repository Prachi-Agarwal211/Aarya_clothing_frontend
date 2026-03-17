import { Metadata } from 'next';
import Link from 'next/link';
import { IndianRupee, CreditCard, HandCoins, AlertCircle, CheckCircle, XCircle, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'COD Policy | Aarya Clothing',
  description: 'Learn about our Cash on Delivery (COD) policy. No extra charges, flexible payment options, and easy conversion to prepaid.',
  keywords: 'COD policy, cash on delivery, payment on delivery, COD charges, prepaid, Aarya Clothing',
  robots: 'index, follow',
};

export default function CODPolicyPage() {
  return (
    <main className="min-h-screen py-12 sm:py-16 md:py-20 relative z-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B76E79]/20 mb-6">
            <HandCoins className="w-8 h-8 text-[#F2C29A]" />
          </div>
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold text-[#F2C29A] mb-4"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            Cash on Delivery (COD) Policy
          </h1>
          <p className="text-[#EAE0D5]/70 text-sm sm:text-base max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Content Container */}
        <div className="relative rounded-3xl p-6 sm:p-8 md:p-12 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          
          {/* COD Benefits Banner */}
          <section className="mb-10">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#F2C29A]/15 to-[#B76E79]/10 border border-[#F2C29A]/25">
              <div className="flex items-center justify-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6 text-[#F2C29A]" />
                <h2 className="text-xl text-[#EAE0D5] font-medium" style={{ fontFamily: 'Cinzel, serif' }}>
                  No Extra COD Charges
                </h2>
              </div>
              <p className="text-[#EAE0D5]/80 leading-relaxed text-center">
                We do <strong className="text-[#F2C29A]">not charge any additional fees</strong> for Cash on 
                Delivery orders. Pay the exact order value at the time of delivery with no hidden charges.
              </p>
            </div>
          </section>

          {/* Section 1 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <IndianRupee className="w-6 h-6 text-[#F2C29A]" />
              COD Availability
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                Cash on Delivery is available for <strong className="text-[#F2C29A]">most pin codes across India</strong>. 
                COD availability is determined based on:
              </p>
              <ul className="space-y-3 ml-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#F2C29A]">✓</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Serviceability:</strong>
                    <p>Your location must be serviceable by our courier partners for COD deliveries</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#F2C29A]">✓</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Order History:</strong>
                    <p>New customers or those with successful COD delivery history</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs text-[#F2C29A]">✓</span>
                  </div>
                  <div>
                    <strong className="text-[#EAE0D5]">Order Value:</strong>
                    <p>Orders within the acceptable COD value limit (see below)</p>
                  </div>
                </li>
              </ul>
              <p className="mt-4">
                COD availability will be shown at checkout. If COD is not available for your location, 
                you will need to choose a prepaid payment method.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <IndianRupee className="w-6 h-6 text-[#F2C29A]" />
              COD Charges
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <div className="p-6 rounded-xl bg-gradient-to-br from-[#F2C29A]/15 to-[#F2C29A]/5 border border-[#F2C29A]/25">
                <div className="text-center">
                  <p className="text-[#EAE0D5]/80 mb-2">Cash on Delivery Fees</p>
                  <p className="text-4xl font-semibold text-[#F2C29A] mb-2">₹0</p>
                  <p className="text-sm text-[#EAE0D5]/60">No extra charges on COD orders</p>
                </div>
              </div>
              <p>
                Unlike many e-commerce platforms, we believe in transparent pricing. When you choose COD:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>No additional COD fees or convenience charges</li>
                <li>No processing fees or handling charges</li>
                <li>Pay only the product price + applicable shipping (if any)</li>
                <li>Same pricing as prepaid orders</li>
              </ul>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                <CheckCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  Note: While we don&apos;t charge extra for COD, prepaid orders may be eligible for exclusive 
                  discounts and offers that are not applicable to COD orders.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <CreditCard className="w-6 h-6 text-[#F2C29A]" />
              Payment Methods on Delivery
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                When you select COD, you can make payment through the following methods at the time of delivery:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-5 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#F2C29A]/20 flex items-center justify-center">
                      <HandCoins className="w-5 h-5 text-[#F2C29A]" />
                    </div>
                    <h3 className="text-[#EAE0D5] font-medium">Cash Payment</h3>
                  </div>
                  <p className="text-sm text-[#EAE0D5]/70">
                    Pay with exact cash to the delivery executive. Please keep change ready for large amounts.
                  </p>
                </div>
                
                <div className="p-5 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#F2C29A]/20 flex items-center justify-center">
                      <IndianRupee className="w-5 h-5 text-[#F2C29A]" />
                    </div>
                    <h3 className="text-[#EAE0D5] font-medium">Digital Payment</h3>
                  </div>
                  <p className="text-sm text-[#EAE0D5]/70">
                    Some courier partners accept UPI, cards, or digital wallets at delivery (subject to availability).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20 mt-4">
                <AlertCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  <strong className="text-[#F2C29A]">Important:</strong> Digital payment options depend on the 
                  courier partner's capabilities in your area. Cash payment is universally accepted. We recommend 
                  keeping exact change ready.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <IndianRupee className="w-6 h-6 text-[#F2C29A]" />
              Order Limits for COD
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                To ensure secure transactions, COD orders are subject to the following limits:
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 flex justify-between items-center">
                  <div>
                    <p className="text-[#EAE0D5] font-medium">Maximum COD Order Value</p>
                    <p className="text-xs text-[#EAE0D5]/60">Per order limit for COD payments</p>
                  </div>
                  <p className="text-[#F2C29A] font-semibold">₹10,000</p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 flex justify-between items-center">
                  <div>
                    <p className="text-[#EAE0D5] font-medium">Monthly COD Limit</p>
                    <p className="text-xs text-[#EAE0D5]/60">Total COD orders per customer per month</p>
                  </div>
                  <p className="text-[#F2C29A] font-semibold">₹25,000</p>
                </div>
                
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 flex justify-between items-center">
                  <div>
                    <p className="text-[#EAE0D5] font-medium">Orders Per Month</p>
                    <p className="text-xs text-[#EAE0D5]/60">Maximum COD orders allowed</p>
                  </div>
                  <p className="text-[#F2C29A] font-semibold">5 Orders</p>
                </div>
              </div>

              <p className="text-sm mt-4">
                These limits may vary based on your order history and delivery location. New customers may 
                have lower initial limits that increase with successful deliveries.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <XCircle className="w-6 h-6 text-[#F2C29A]" />
              Failed Delivery Attempts
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                If you&apos;re unavailable or refuse to accept a COD delivery:
              </p>
              
              <div className="space-y-4 mt-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#F2C29A]/20 border border-[#F2C29A]/30 flex items-center justify-center text-[#F2C29A] font-medium">
                      1
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#EAE0D5] font-medium mb-2">First Failed Attempt</h3>
                    <p className="text-sm">
                      Courier will attempt redelivery the next business day. You will receive an SMS/Call 
                      notification with the new delivery schedule.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#F2C29A]/20 border border-[#F2C29A]/30 flex items-center justify-center text-[#F2C29A] font-medium">
                      2
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#EAE0D5] font-medium mb-2">Second Failed Attempt</h3>
                    <p className="text-sm">
                      Final delivery attempt will be made. Please ensure someone is available to accept 
                      and pay for the order.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#B76E79]/30 border border-[#B76E79]/40 flex items-center justify-center text-[#B76E79] font-medium">
                      3
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[#EAE0D5] font-medium mb-2">After Final Attempt</h3>
                    <p className="text-sm">
                      If all delivery attempts fail, the order will be returned to us and <strong className="text-[#B76E79]">cancelled</strong>. 
                      Repeated COD failures may affect your ability to place future COD orders.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20 mt-4">
                <AlertCircle className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  <strong className="text-[#F2C29A]">Note:</strong> If you frequently fail to accept COD 
                  deliveries, we may restrict COD as a payment option for your account and require prepaid 
                  payment for future orders.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <CheckCircle className="w-6 h-6 text-[#F2C29A]" />
              Conversion to Prepaid
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                You can convert your COD order to prepaid at any time before dispatch:
              </p>
              
              <div className="p-5 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <h3 className="text-[#EAE0D5] font-medium mb-3">How to Convert:</h3>
                <ol className="space-y-2 text-sm text-[#EAE0D5]/80 list-decimal list-inside">
                  <li>Log in to your account and go to "My Orders"</li>
                  <li>Select the COD order you want to convert</li>
                  <li>Click on "Convert to Prepaid"</li>
                  <li>Complete the payment using your preferred method</li>
                  <li>Receive confirmation email once payment is successful</li>
                </ol>
              </div>

              <p>
                Alternatively, contact our customer support team to initiate the conversion.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <h4 className="text-[#EAE0D5] font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#F2C29A]" />
                    Benefits of Prepaid
                  </h4>
                  <ul className="text-sm text-[#EAE0D5]/70 space-y-1">
                    <li>• Faster processing and dispatch</li>
                    <li>• Exclusive prepaid-only offers</li>
                    <li>• No need to keep cash ready</li>
                    <li>• Contactless delivery option</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10">
                  <h4 className="text-[#EAE0D5] font-medium mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#F2C29A]" />
                    Refund on Cancellation
                  </h4>
                  <p className="text-sm text-[#EAE0D5]/70">
                    If you cancel a prepaid order, refunds are processed within 5-7 business days to the 
                    original payment method.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <AlertCircle className="w-6 h-6 text-[#F2C29A]" />
              COD Restrictions
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                COD may not be available in the following scenarios:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Orders above ₹10,000 (maximum COD limit)</li>
                <li>Certain remote or high-risk locations</li>
                <li>Customers with history of failed COD deliveries</li>
                <li>Customers with excessive COD order cancellations</li>
                <li>During festive seasons or high-demand periods (temporary restrictions)</li>
                <li>For customized or made-to-order products</li>
              </ul>
              <p>
                These restrictions are in place to ensure secure and efficient delivery operations.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <IndianRupee className="w-6 h-6 text-[#F2C29A]" />
              Exact Change Request
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F2C29A]/10 border border-[#F2C29A]/20">
                <HandCoins className="w-5 h-5 text-[#F2C29A] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EAE0D5]/70">
                  <strong className="text-[#F2C29A]">Please Keep Exact Change Ready:</strong> Our delivery 
                  executives may not always have change for large denominations (₹500, ₹2000). We appreciate 
                  your cooperation in arranging exact change or smaller denominations.
                </p>
              </div>
              <p>
                If exact change is not available, the delivery executive may:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Request you to arrange change from nearby sources</li>
                <li>Offer digital payment options (if available)</li>
                <li>Reschedule delivery for a later time</li>
              </ul>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <CheckCircle className="w-6 h-6 text-[#F2C29A]" />
              Order Verification
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                For security purposes, COD orders may require additional verification:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>OTP verification before dispatch for high-value orders</li>
                <li>Phone confirmation call from our team</li>
                <li>ID proof may be requested at the time of delivery</li>
                <li>Signature or biometric confirmation upon delivery</li>
              </ul>
              <p>
                These measures help prevent fraud and ensure your order reaches the right person.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-10">
            <h2 className="text-xl sm:text-2xl text-[#EAE0D5] mb-4 flex items-center gap-3" style={{ fontFamily: 'Cinzel, serif' }}>
              <IndianRupee className="w-6 h-6 text-[#F2C29A]" />
              Contact Us
            </h2>
            <div className="space-y-4 text-[#EAE0D5]/70 leading-relaxed pl-4">
              <p>
                For any questions about our COD policy or payment-related queries, please contact us:
              </p>
              <div className="p-6 rounded-xl bg-[#F2C29A]/5 border border-[#F2C29A]/10 space-y-3">
                <p className="text-[#EAE0D5]">
                  <strong className="text-[#F2C29A]">Email:</strong> payments@aaryaclothing.com
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
