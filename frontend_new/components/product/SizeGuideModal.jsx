'use client';

import { X, Ruler, MessageCircle } from 'lucide-react';
import Modal from '../ui/Modal';

/**
 * Simplified Size Guide Modal
 * 
 * Shows a clean, simple size chart: S(36), M(38), L(40), XL(42), XXL(44), XXXL(46)
 * No hip, chest, waist, shoulder complexity — just size letters and their numbers.
 */
export default function SizeGuideModal({ isOpen, onClose }) {
  const sizeChart = [
    { size: 'S', number: 36 },
    { size: 'M', number: 38 },
    { size: 'L', number: 40 },
    { size: 'XL', number: 42 },
    { size: 'XXL', number: 44 },
    { size: 'XXXL', number: 46 },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="bg-[#0B0608] border border-[#B76E79]/20 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7A2F57] to-[#B76E79] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Ruler className="w-6 h-6 text-[#F2C29A]" />
            <h2 className="text-xl font-bold text-[#F2C29A]">Size Guide</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#F2C29A] hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            aria-label="Close size guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Simple Size Table */}
        <div className="p-6">
          <div className="overflow-hidden rounded-lg border border-[#B76E79]/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#7A2F57]/20">
                  <th className="text-left py-3 px-6 text-[#F2C29A] font-semibold">Size</th>
                  <th className="text-left py-3 px-6 text-[#F2C29A] font-semibold">Number</th>
                </tr>
              </thead>
              <tbody>
                {sizeChart.map((row, index) => (
                  <tr
                    key={row.size}
                    className={`border-t border-[#B76E79]/10 hover:bg-[#7A2F57]/10 transition-colors ${
                      index % 2 === 0 ? 'bg-[#0B0608]/20' : 'bg-[#0B0608]/40'
                    }`}
                  >
                    <td className="py-3.5 px-6 text-[#F2C29A] font-bold text-base">{row.size}</td>
                    <td className="py-3.5 px-6 text-[#EAE0D5] text-base">{row.number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tips */}
          <div className="mt-6 bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-lg p-4">
            <p className="text-xs text-[#EAE0D5]/60 leading-relaxed">
              When in between sizes, we recommend sizing up for comfort.
            </p>
          </div>

          {/* Chat Support */}
          <button
            onClick={() => window.open('/chat', '_blank')}
            className="w-full mt-4 flex items-center justify-center gap-2 bg-[#7A2F57]/20 hover:bg-[#7A2F57]/30 border border-[#B76E79]/40 text-[#F2C29A] px-4 py-3 rounded-lg transition-all hover:scale-[1.02]"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Need Help? Chat with Our Style Experts</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
