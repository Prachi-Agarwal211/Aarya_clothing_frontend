'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Share2, MessageCircle, Link as LinkIcon, X, Check, Copy } from 'lucide-react';

/**
 * Product Share Button with WhatsApp integration
 */
export default function ProductShareButton({ product, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getShareUrl = () => {
    if (typeof window !== 'undefined') return window.location.href;
    return '';
  };

  const getWhatsAppShareText = () => {
    const url = getShareUrl();
    const price = product?.price ? '₹' + product.price : '';
    const name = product?.name || 'Check out this product';
    return encodeURIComponent('✨ ' + name + (price ? ' - ' + price : '') + '\n\n' + url);
  };

  const handleWhatsAppShare = () => {
    const text = getWhatsAppShareText();
    window.open('https://wa.me/?text=' + text, '_blank');
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-3.5 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:text-[#F2C29A] hover:border-[#F2C29A]/40 transition-all duration-300"
        aria-label="Share product"
      >
        <Share2 className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#0B0608] border border-[#B76E79]/30 rounded-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[#B76E79]/20">
            <p className="text-[#EAE0D5]/80 text-xs font-medium uppercase tracking-wider">Share this product</p>
          </div>
          <div className="p-2">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#7A2F57]/20 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </div>
              <span className="text-[#EAE0D5]/90 text-sm">Share on WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#7A2F57]/20 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-[#B76E79]/20 flex items-center justify-center">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-[#B76E79]" />}
              </div>
              <span className="text-[#EAE0D5]/90 text-sm">{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-[#7A2F57]/10 transition-colors text-[#EAE0D5]/50 text-xs"
            >
              <X className="w-3 h-3" />
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
