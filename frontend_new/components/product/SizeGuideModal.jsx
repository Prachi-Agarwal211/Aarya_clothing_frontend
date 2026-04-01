'use client';

import { useState, useEffect } from 'react';
import { X, Ruler, MessageCircle, Info } from 'lucide-react';
import Modal from '../ui/Modal';
import { getCoreBaseUrl } from '@/lib/baseApi';

/**
 * Size Guide Modal Component
 * 
 * Displays comprehensive size charts for different product categories
 * with measurement guides and fit type information.
 */
export default function SizeGuideModal({ isOpen, onClose, category = 'kurta' }) {
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [sizeData, setSizeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' or 'guide'

  // Fetch size guide data
  useEffect(() => {
    if (isOpen) {
      fetchSizeGuide(selectedCategory);
    }
  }, [isOpen, selectedCategory]);

  const fetchSizeGuide = async (category) => {
    setLoading(true);
    try {
      const response = await fetch(`${getCoreBaseUrl()}/api/v1/size-guide?category=${category}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSizeData(data);
      }
    } catch (error) {
      console.error('Error fetching size guide:', error);
    } finally {
      setLoading(false);
    }
  };

  // Category display names
  const categoryNames = {
    kurta: 'Kurtas & Kurtis',
    tops: 'Tops & Blouses',
    bottoms: 'Bottoms & Leggings',
    dress: 'Dresses & Gowns',
    lehenga: 'Lehengas',
    saree: 'Saree Blouses',
  };

  // Measurement labels
  const measurementLabels = {
    chest_bust: 'Chest/Bust',
    waist: 'Waist',
    hip: 'Hip',
    shoulder: 'Shoulder',
    length: 'Length',
    inseam: 'Inseam',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="bg-[#0B0608] border border-[#B76E79]/20 rounded-xl overflow-hidden max-h-[90vh] flex flex-col">
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

        {/* Category Selector */}
        <div className="p-4 border-b border-[#B76E79]/20">
          <label className="text-sm text-[#EAE0D5]/70 mb-2 block">Select Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full bg-[#0B0608]/40 border border-[#B76E79]/20 rounded-lg px-4 py-2.5 text-[#EAE0D5] focus:outline-none focus:border-[#B76E79] transition-colors"
          >
            {Object.entries(categoryNames).map(([key, name]) => (
              <option key={key} value={key} className="bg-[#0B0608]">
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#B76E79]/20">
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chart'
                ? 'bg-[#7A2F57]/20 text-[#F2C29A] border-b-2 border-[#B76E79]'
                : 'text-[#EAE0D5]/60 hover:text-[#EAE0D5]'
            }`}
          >
            Size Chart
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'guide'
                ? 'bg-[#7A2F57]/20 text-[#F2C29A] border-b-2 border-[#B76E79]'
                : 'text-[#EAE0D5]/60 hover:text-[#EAE0D5]'
            }`}
          >
            How to Measure
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#B76E79] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activeTab === 'chart' ? (
            <SizeChart sizeData={sizeData} measurementLabels={measurementLabels} />
          ) : (
            <MeasurementGuide measurementGuide={sizeData?.measurement_guide} />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#B76E79]/20 bg-[#0B0608]/40">
          <div className="flex items-start gap-3 mb-4">
            <Info className="w-5 h-5 text-[#B76E79] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#EAE0D5]/60">
              Measurements may vary slightly based on fabric and design. For custom fittings or special requirements, 
              please contact our customer support team.
            </p>
          </div>
          
          <button
            onClick={() => window.open('/chat', '_blank')}
            className="w-full flex items-center justify-center gap-2 bg-[#7A2F57]/20 hover:bg-[#7A2F57]/30 border border-[#B76E79]/40 text-[#F2C29A] px-4 py-3 rounded-lg transition-all hover:scale-[1.02]"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Still Confused? Chat with Our Style Experts</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Size Chart Table Component
 */
function SizeChart({ sizeData, measurementLabels }) {
  if (!sizeData?.size_chart) {
    return (
      <div className="text-center py-12 text-[#EAE0D5]/60">
        <p>No size chart available for this category.</p>
      </div>
    );
  }

  const sizes = sizeData.size_chart;
  const measurements = sizes[0] ? Object.keys(sizes[0]).filter(k => k !== 'size') : [];

  return (
    <div className="space-y-4">
      {/* Size Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#B76E79]/20">
              <th className="text-left py-3 px-3 text-[#F2C29A] font-semibold sticky left-0 bg-[#0B0608]">
                Size
              </th>
              {measurements.map((measurement) => (
                <th
                  key={measurement}
                  className="text-center py-3 px-3 text-[#F2C29A] font-semibold whitespace-nowrap"
                >
                  {measurementLabels[measurement] || measurement.replace('_', ' ').toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((size, index) => (
              <tr
                key={size.size}
                className={`border-b border-[#B76E79]/10 hover:bg-[#7A2F57]/10 transition-colors ${
                  index % 2 === 0 ? 'bg-[#0B0608]/20' : 'bg-[#0B0608]/40'
                }`}
              >
                <td className="py-3 px-3 text-[#F2C29A] font-bold sticky left-0 bg-inherit">
                  {size.size}
                </td>
                {measurements.map((measurement) => {
                  const value = size[measurement];
                  return (
                    <td key={measurement} className="text-center py-3 px-3 text-[#EAE0D5]">
                      {value ? (
                        <div className="flex flex-col items-center">
                          <span className="font-medium">{value.inches}"</span>
                          <span className="text-xs text-[#EAE0D5]/50">
                            ({value.centimeters} cm)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#EAE0D5]/30">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Size Selection Tips */}
      <div className="bg-[#7A2F57]/10 border border-[#B76E79]/20 rounded-lg p-4 mt-6">
        <h3 className="text-sm font-semibold text-[#F2C29A] mb-2">💡 Size Selection Tips</h3>
        <ul className="text-xs text-[#EAE0D5]/70 space-y-1.5 list-disc list-inside">
          <li>Choose your size based on your largest measurement</li>
          <li>For a relaxed fit, consider sizing up</li>
          <li>For a fitted look, choose your exact measurements</li>
          <li>Check the fit type (Regular/Slim/Relaxed) on the product page</li>
          <li>When in between sizes, we recommend sizing up for comfort</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Measurement Guide Component
 */
function MeasurementGuide({ measurementGuide }) {
  if (!measurementGuide) {
    return (
      <div className="text-center py-12 text-[#EAE0D5]/60">
        <p>Measurement guide not available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Object.entries(measurementGuide).map(([key, data]) => (
        <div
          key={key}
          className="bg-[#0B0608]/40 border border-[#B76E79]/20 rounded-lg p-4"
        >
          <h3 className="text-base font-semibold text-[#F2C29A] mb-2">
            {data.name}
          </h3>
          <p className="text-sm text-[#EAE0D5]/70 mb-3">{data.description}</p>
          
          {data.tips && data.tips.length > 0 && (
            <div className="bg-[#7A2F57]/10 rounded-lg p-3">
              <p className="text-xs font-medium text-[#B76E79] mb-2">💡 Tips:</p>
              <ul className="text-xs text-[#EAE0D5]/60 space-y-1">
                {data.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-[#B76E79] mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}

      {/* General Measurement Tips */}
      <div className="bg-gradient-to-r from-[#7A2F57]/20 to-[#B76E79]/20 border border-[#B76E79]/20 rounded-lg p-4 mt-6">
        <h3 className="text-sm font-semibold text-[#F2C29A] mb-3">📏 General Measurement Tips</h3>
        <ul className="text-xs text-[#EAE0D5]/70 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-[#B76E79] mt-0.5">✓</span>
            Use a flexible measuring tape for accurate measurements
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B76E79] mt-0.5">✓</span>
            Keep the tape parallel to the floor for horizontal measurements
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B76E79] mt-0.5">✓</span>
            Don&apos;t pull the tape too tight - it should be snug but comfortable
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B76E79] mt-0.5">✓</span>
            Measure over light clothing or undergarments for best results
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B76E79] mt-0.5">✓</span>
            Take measurements in the morning for most accurate results
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#B76E79] mt-0.5">✓</span>
            Have someone help you for more accurate back measurements
          </li>
        </ul>
      </div>
    </div>
  );
}
