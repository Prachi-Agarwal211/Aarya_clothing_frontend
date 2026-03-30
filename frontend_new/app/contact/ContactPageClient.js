'use client';

import { useCallback } from 'react';
import { MessageCircle, Clock, Mail, Phone, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import EnhancedHeader from '@/components/landing/EnhancedHeader';
import Footer from '@/components/landing/Footer';

export default function ContactPageClient({ breadcrumbSchema, contactPageSchema }) {
  const handleChatOpen = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openSupportChat'));
    }
  }, []);

  return (
    <>
      <div className="relative z-10">
        <EnhancedHeader />

        {/* Hero */}
        <div className="pt-32 pb-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-heading text-[#F2C29A] mb-6" style={{ fontFamily: 'Cinzel, serif' }}>
              Get In Touch
            </h1>
            <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A] to-transparent mx-auto mb-6" aria-hidden="true" />
            <p className="text-[#EAE0D5]/70 text-lg max-w-2xl mx-auto">
              Our support team is here to help. Chat with us directly for the fastest response.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="pb-20 px-4">
          <div className="max-w-5xl mx-auto space-y-8">

            {/* Primary CTA — Live Chat */}
            <div className="rounded-3xl p-10 bg-gradient-to-br from-[#7A2F57]/20 to-[#B76E79]/10 backdrop-blur-md border border-[#B76E79]/30 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7A2F57] to-[#B76E79] mb-6 shadow-lg shadow-[#B76E79]/30">
                <MessageCircle className="w-8 h-8 text-white" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-heading text-[#F2C29A] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>Chat With Us Live</h2>
              <p className="text-[#EAE0D5]/60 mb-6 max-w-md mx-auto text-sm">
                Connect with our support team instantly. Ask about orders, products, returns, or anything else.
              </p>
              <button
                onClick={handleChatOpen}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium text-base hover:opacity-90 active:scale-95 transition-all duration-200 shadow-lg shadow-[#B76E79]/25"
                aria-label="Start live chat"
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                Start a Conversation
              </button>
              <p className="text-[#EAE0D5]/30 text-xs mt-4 flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                Typically replies within a few minutes
              </p>
            </div>

            {/* Contact Details + Quick Links */}
            <div className="grid md:grid-cols-2 gap-6">

              {/* Contact Info */}
              <div className="rounded-3xl p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 space-y-6">
                <h2 className="text-xl font-heading text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Other Ways to Reach Us</h2>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/20 flex-shrink-0">
                    <Mail className="w-5 h-5 text-[#B76E79]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[#EAE0D5] font-medium text-sm mb-0.5">Email</p>
                    <a href="mailto:support@aaryaclothing.in" className="text-[#B76E79] hover:underline text-sm">
                      support@aaryaclothing.in
                    </a>
                    <p className="text-[#EAE0D5]/40 text-xs mt-1">We reply within 24–48 hours</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/20 flex-shrink-0">
                    <Phone className="w-5 h-5 text-[#B76E79]" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[#EAE0D5] font-medium text-sm mb-0.5">Phone</p>
                    <a href="tel:+919876543210" className="text-[#B76E79] hover:underline text-sm">
                      +91 98765 43210
                    </a>
                    <p className="text-[#EAE0D5]/40 text-xs mt-1">Mon–Sat, 10AM–7PM IST</p>
                  </div>
                </div>
              </div>

              {/* Quick Help Links */}
              <div className="rounded-3xl p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15">
                <h2 className="text-xl font-heading text-[#F2C29A] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>Quick Help</h2>
                <p className="text-[#EAE0D5]/50 text-sm mb-5">Find answers to common questions:</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Shipping Policy', href: '/shipping' },
                    { label: 'Returns & Refunds', href: '/returns' },
                    { label: 'Payment Policy', href: '/payment-policy' },
                    { label: 'Privacy Policy', href: '/privacy' },
                    { label: 'Terms of Service', href: '/terms' },
                  ].map(({ label, href }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/15 text-[#EAE0D5]/80 text-sm hover:bg-[#B76E79]/20 hover:text-[#EAE0D5] transition-colors group"
                    >
                      {label}
                      <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70 transition-opacity" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        <Footer />
      </div>
    </>
  );
}
