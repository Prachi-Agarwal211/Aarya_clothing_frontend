'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Mail, Phone, MapPin, Clock, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const EnhancedHeader = dynamic(() => import('@/components/landing/EnhancedHeader'), { ssr: false });
const Footer = dynamic(() => import('@/components/landing/Footer'), { ssr: false });

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Simulate form submission - in production, this would call an API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For now, show success (in production, would POST to contact API)
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      setError('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen text-[#EAE0D5]">
      <div className="relative z-10">
        <EnhancedHeader />
        
        {/* Hero Section */}
        <div className="pt-32 pb-16 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-heading text-[#F2C29A] mb-6">Get In Touch</h1>
            <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#F2C29A] to-transparent mx-auto mb-6" />
            <p className="text-[#EAE0D5]/70 text-lg max-w-2xl mx-auto">
              We'd love to hear from you. Whether you have a question about our products, need styling advice, 
              or need help with an order, our team is here to assist.
            </p>
          </div>
        </div>

        {/* Contact Content */}
        <div className="pb-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              
              {/* Contact Information */}
              <div className="space-y-8">
                <div className="rounded-3xl p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15">
                  <h2 className="text-2xl font-heading text-[#F2C29A] mb-6">Contact Information</h2>
                  
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/20">
                        <MapPin className="w-5 h-5 text-[#B76E79]" />
                      </div>
                      <div>
                        <h3 className="text-[#EAE0D5] font-medium mb-1">Visit Our Store</h3>
                        <p className="text-[#EAE0D5]/60 text-sm">
                          Aarya Clothing<br />
                          Jaipur, Rajasthan<br />
                          India
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/20">
                        <Mail className="w-5 h-5 text-[#B76E79]" />
                      </div>
                      <div>
                        <h3 className="text-[#EAE0D5] font-medium mb-1">Email Us</h3>
                        <p className="text-[#EAE0D5]/60 text-sm">
                          <a href="mailto:info@aaryaclothing.in" className="text-[#B76E79] hover:underline">info@aaryaclothing.in</a>
                        </p>
                        <p className="text-[#EAE0D5]/40 text-xs mt-1">
                          For inquiries, support, or feedback
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/20">
                        <Phone className="w-5 h-5 text-[#B76E79]" />
                      </div>
                      <div>
                        <h3 className="text-[#EAE0D5] font-medium mb-1">Call Us</h3>
                        <p className="text-[#EAE0D5]/60 text-sm">
                          +91 98765 43210<br />
                          Mon - Sat: 10:00 AM - 7:00 PM
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-[#B76E79]/10 border border-[#B76E79]/20">
                        <Clock className="w-5 h-5 text-[#B76E79]" />
                      </div>
                      <div>
                        <h3 className="text-[#EAE0D5] font-medium mb-1">Business Hours</h3>
                        <p className="text-[#EAE0D5]/60 text-sm">
                          Monday - Saturday: 10:00 AM - 7:00 PM<br />
                          Sunday: Closed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="rounded-3xl p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15">
                  <h2 className="text-2xl font-heading text-[#F2C29A] mb-4">Quick Help</h2>
                  <p className="text-[#EAE0D5]/60 text-sm mb-4">
                    Find answers to common questions in our policy pages:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a href="/shipping" className="px-4 py-2 rounded-lg bg-[#B76E79]/10 border border-[#B76E79]/20 text-[#EAE0D5] text-sm hover:bg-[#B76E79]/20 transition-colors">
                      Shipping Policy
                    </a>
                    <a href="/returns" className="px-4 py-2 rounded-lg bg-[#B76E79]/10 border border-[#B76E79]/20 text-[#EAE0D5] text-sm hover:bg-[#B76E79]/20 transition-colors">
                      Returns & Refunds
                    </a>
                    <a href="/cod-policy" className="px-4 py-2 rounded-lg bg-[#B76E79]/10 border border-[#B76E79]/20 text-[#EAE0D5] text-sm hover:bg-[#B76E79]/20 transition-colors">
                      COD Policy
                    </a>
                    <a href="/privacy" className="px-4 py-2 rounded-lg bg-[#B76E79]/10 border border-[#B76E79]/20 text-[#EAE0D5] text-sm hover:bg-[#B76E79]/20 transition-colors">
                      Privacy Policy
                    </a>
                    <a href="/terms" className="px-4 py-2 rounded-lg bg-[#B76E79]/10 border border-[#B76E79]/20 text-[#EAE0D5] text-sm hover:bg-[#B76E79]/20 transition-colors">
                      Terms of Service
                    </a>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="rounded-3xl p-8 bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15">
                <h2 className="text-2xl font-heading text-[#F2C29A] mb-6">Send Us a Message</h2>
                
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-xl text-[#EAE0D5] font-medium mb-2">Message Sent!</h3>
                    <p className="text-[#EAE0D5]/60 text-sm mb-6">
                      Thank you for reaching out. We'll get back to you within 24-48 hours.
                    </p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="px-6 py-2.5 rounded-xl bg-[#B76E79]/20 border border-[#B76E79]/40 text-[#EAE0D5] hover:bg-[#B76E79]/30 transition-colors"
                    >
                      Send Another Message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <div className="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="name" className="block text-sm text-[#EAE0D5]/70 mb-2">Name *</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 transition-colors"
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block textName-sm text-[#EAE0D5]/70 mb-2">Email *</label>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 transition-colors"
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="phone" className="block text-sm text-[#EAE0D5]/70 mb-2">Phone Number</label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 transition-colors"
                          placeholder="+91 98765 43210"
                        />
                      </div>
                      <div>
                        <label htmlFor="subject" className="block text-sm text-[#EAE0D5]/70 mb-2">Subject *</label>
                        <select
                          id="subject"
                          name="subject"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                          className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] focus:outline-none focus:border-[#B76E79]/50 transition-colors"
                        >
                          <option value="">Select a topic</option>
                          <option value="order">Order Related</option>
                          <option value="product">Product Inquiry</option>
                          <option value="return">Returns & Refunds</option>
                          <option value="bulk">Bulk Orders</option>
                          <option value="feedback">Feedback</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm text-[#EAE0D5]/70 mb-2">Message *</label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        rows={5}
                        className="w-full px-4 py-3 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 transition-colors resize-none"
                        placeholder="Tell us how we can help you..."
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Send Message
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </main>
  );
}
