'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, MessageCircle, Phone, Mail } from 'lucide-react';

export default function FAQPage() {
  const [openCategory, setOpenCategory] = useState('orders');
  const [openQuestion, setOpenQuestion] = useState(null);

  const categories = [
    { id: 'orders', name: 'Orders & Tracking' },
    { id: 'shipping', name: 'Shipping & Delivery' },
    { id: 'returns', name: 'Returns & Exchanges' },
    { id: 'products', name: 'Products & Sizing' },
    { id: 'payment', name: 'Payment & Pricing' }
  ];

  const faqs = {
    orders: [
      {
        id: 'o1',
        q: 'How can I track my order?',
        a: 'Once your order is shipped, you will receive an email with a tracking link. You can also track your order by logging into your account and visiting the "My Orders" section.'
      },
      {
        id: 'o2',
        q: 'Can I modify or cancel my order?',
        a: 'We process orders quickly to ensure fast delivery. You can only cancel or modify your order within 2 hours of placing it. Please contact our customer support immediately for assistance.'
      },
      {
        id: 'o3',
        q: 'What should I do if I receive a defective item?',
        a: 'We apologize for the inconvenience. Please contact our support team within 48 hours of receiving the item with photos of the defect, and we will arrange a replacement or refund.'
      }
    ],
    shipping: [
      {
        id: 's1',
        q: 'How long does shipping take?',
        a: 'Standard shipping within India takes 3-5 business days. Express shipping is available for select pincodes and takes 1-2 business days.'
      },
      {
        id: 's2',
        q: 'Do you ship internationally?',
        a: 'Currently, we only ship within India. We are working on expanding our delivery network globally.'
      },
      {
        id: 's3',
        q: 'How much are the shipping charges?',
        a: 'We offer free standard shipping on all orders above ₹999. For orders below this amount, a nominal fee of ₹99 is applied.'
      }
    ],
    returns: [
      {
        id: 'r1',
        q: 'What is your return policy?',
        a: 'We accept returns within 7 days of delivery. The items must be unused, unwashed, and have all original tags attached. Customized or clearance items are not eligible for return.'
      },
      {
        id: 'r2',
        q: 'How do I initiate a return?',
        a: 'You can initiate a return from the "My Orders" section in your account. Select the item you wish to return and choose a reason. Our courier partner will pick it up within 24-48 hours.'
      },
      {
        id: 'r3',
        q: 'When will I get my refund?',
        a: 'Once we receive and inspect the returned item, we will process the refund within 3-5 business days. It may take an additional 5-7 days for the amount to reflect in your bank account.'
      }
    ],
    products: [
      {
        id: 'p1',
        q: 'How do I find my size?',
        a: 'Each product page features a detailed size guide. We recommend measuring yourself and comparing it with our size chart. If you are between sizes, we suggest sizing up for a comfortable fit.'
      },
      {
        id: 'p2',
        q: 'Are the colors exactly as shown in the pictures?',
        a: 'We make every effort to display the colors accurately. However, actual colors may vary slightly due to different device screen settings and lighting conditions during photography.'
      },
      {
        id: 'p3',
        q: 'How should I care for my Aarya garments?',
        a: 'Care instructions are provided on the label of each garment and on the product page. Generally, we recommend dry cleaning for silk and heavy embroidery, and gentle hand wash for cotton blends.'
      }
    ],
    payment: [
      {
        id: 'py1',
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit/debit cards, UPI, net banking, and popular mobile wallets via Razorpay. All payments are processed securely online.'
      },
      {
        id: 'py2',
        q: 'Is my payment information secure?',
        a: 'Yes, completely. We use industry-standard encryption protocols and secure payment gateways (Razorpay) to ensure your payment information is 100% safe.'
      },
      {
        id: 'py3',
        q: 'Why did my payment fail?',
        a: 'Payments can fail due to various reasons like poor internet connection, bank server downtime, or incorrect details. If money was deducted, it will be automatically refunded by your bank within 5-7 business days.'
      }
    ]
  };

  const toggleQuestion = (id) => {
    if (openQuestion === id) {
      setOpenQuestion(null);
    } else {
      setOpenQuestion(id);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0608] text-[#EAE0D5] relative overflow-hidden">
      {/* Background Pattern */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B0608] via-[#0B0608] to-[#1a0f12]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#7A2F57]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#B76E79]/10 rounded-full blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 z-10">
        <div className="container mx-auto px-4 md:px-8 text-center max-w-4xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-[#EAE0D5]/70 font-light" style={{ fontFamily: 'Playfair Display, serif' }}>
            Find answers to common questions about our products, orders, shipping, and returns.
            If you need further assistance, our support team is always here to help.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative z-10 pb-24">
        <div className="container mx-auto px-4 md:px-8 max-w-6xl">
          <div className="flex flex-col lg:flex-row gap-12">
            
            {/* Sidebar / Categories */}
            <div className="lg:w-1/3">
              <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/20 rounded-2xl p-6 sticky top-32">
                <h3 className="text-xl font-medium mb-6 text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                  Categories
                </h3>
                <div className="flex flex-col gap-2">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setOpenCategory(category.id);
                        setOpenQuestion(null);
                      }}
                      className={`text-left px-4 py-3 rounded-xl transition-all duration-300 ${
                        openCategory === category.id
                          ? 'bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-medium shadow-lg shadow-[#7A2F57]/20'
                          : 'text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 hover:text-[#EAE0D5]'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                {/* Contact Help */}
                <div className="mt-10 pt-8 border-t border-[#B76E79]/20">
                  <h4 className="text-lg font-medium mb-4 text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                    Still need help?
                  </h4>
                  <div className="space-y-4">
                    <a href="mailto:support@aaryaclothing.com" className="flex items-center gap-3 text-[#EAE0D5]/70 hover:text-[#F2C29A] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#B76E79]/10 flex items-center justify-center border border-[#B76E79]/20">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span className="text-sm">support@aaryaclothing.com</span>
                    </a>
                    <a href="tel:+919876543210" className="flex items-center gap-3 text-[#EAE0D5]/70 hover:text-[#F2C29A] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#B76E79]/10 flex items-center justify-center border border-[#B76E79]/20">
                        <Phone className="w-4 h-4" />
                      </div>
                      <span className="text-sm">+91 98765 43210</span>
                    </a>
                    <Link href="/contact" className="flex items-center gap-3 text-[#EAE0D5]/70 hover:text-[#F2C29A] transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#B76E79]/10 flex items-center justify-center border border-[#B76E79]/20">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <span className="text-sm">Contact Form</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* FAQ Items */}
            <div className="lg:w-2/3">
              <div className="space-y-4">
                {faqs[openCategory]?.map(faq => (
                  <div 
                    key={faq.id}
                    className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/20 rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#B76E79]/40"
                  >
                    <button
                      onClick={() => toggleQuestion(faq.id)}
                      className="w-full flex items-center justify-between p-6 text-left"
                    >
                      <h3 className="text-lg font-medium pr-8" style={{ fontFamily: 'Playfair Display, serif' }}>
                        {faq.q}
                      </h3>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full border border-[#B76E79]/30 flex items-center justify-center transition-transform duration-300 ${
                        openQuestion === faq.id ? 'bg-[#B76E79]/20 rotate-180' : ''
                      }`}>
                        <ChevronDown className="w-4 h-4 text-[#F2C29A]" />
                      </div>
                    </button>
                    
                    <div 
                      className={`transition-all duration-300 ease-in-out ${
                        openQuestion === faq.id ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      <div className="px-6 pb-6 pt-0 text-[#EAE0D5]/70 leading-relaxed font-light">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
