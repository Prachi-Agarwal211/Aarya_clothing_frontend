import { Phone, Building2, Handshake } from 'lucide-react';

export default function WholesaleSection() {
  return (
    <section className="py-16 sm:py-20 relative z-10">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Building2 className="w-8 h-8 text-[#F2C29A]" />
              <h2 className="text-2xl sm:text-3xl font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                Wholesale Enquiries
              </h2>
              <Handshake className="w-8 h-8 text-[#F2C29A]" />
            </div>
            <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A] to-transparent mx-auto mb-4" />
            <p className="text-[#EAE0D5]/60 text-sm sm:text-base max-w-2xl mx-auto">
              Looking to stock Aarya Clothing in your store? We offer exclusive wholesale pricing for bulk orders.
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wholesale Contact Card */}
            <div className="group relative bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/20 rounded-2xl p-6 sm:p-8 hover:border-[#F2C29A]/40 hover:shadow-[0_0_40px_rgba(242,194,154,0.1)] transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-[#7A2F57]/5 to-[#B76E79]/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F2C29A]/20 to-[#B76E79]/10 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-[#F2C29A]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#F2C29A]">Wholesale Sales</h3>
                    <p className="text-xs text-[#EAE0D5]/50">Bulk Orders &amp; Distribution</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <a
                    href="tel:+919460518647"
                    className="block text-xl sm:text-2xl font-bold text-white hover:text-[#F2C29A] transition-colors"
                    aria-label="Call wholesale sales"
                  >
                    +91 94605 18647
                  </a>
                  <p className="text-sm text-[#EAE0D5]/60">
                    Available Mon-Sat, 10AM-7PM IST
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-[#B76E79]/10">
                  <h4 className="text-sm font-medium text-[#EAE0D5]/70 mb-2">Wholesale Benefits:</h4>
                  <ul className="space-y-1.5 text-xs text-[#EAE0D5]/50">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F2C29A]" />
                      Exclusive bulk pricing
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F2C29A]" />
                      Priority order processing
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#F2C29A]" />
                      Dedicated support team
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Why Partner With Us Card */}
            <div className="group relative bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/20 rounded-2xl p-6 sm:p-8 hover:border-[#F2C29A]/40 hover:shadow-[0_0_40px_rgba(242,194,154,0.1)] transition-all duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-[#7A2F57]/5 to-[#B76E79]/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-[#F2C29A] mb-4">Why Partner With Us?</h3>
                
                <ul className="space-y-3 text-sm text-[#EAE0D5]/60">
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#F2C29A] text-xs">✓</span>
                    </span>
                    <span>Premium quality ethnic wear with consistent demand</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#F2C29A] text-xs">✓</span>
                    </span>
                    <span>Competitive margins for retail partners</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#F2C29A] text-xs">✓</span>
                    </span>
                    <span>Regular new collections and trending designs</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#F2C29A]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[#F2C29A] text-xs">✓</span>
                    </span>
                    <span>Reliable delivery and order fulfillment</span>
                  </li>
                </ul>

                <div className="mt-6 pt-6 border-t border-[#B76E79]/10">
                  <p className="text-xs text-[#EAE0D5]/50 mb-3">Ready to grow your business with us?</p>
                  <a
                    href="tel:+919460518647"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium rounded-xl hover:opacity-90 transition-opacity text-sm"
                  >
                    <Phone className="w-4 h-4" />
                    Call Now
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
