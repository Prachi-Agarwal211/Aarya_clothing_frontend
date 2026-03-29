'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, RefreshCw, Loader2, AlertCircle, CheckCircle,
  Settings, Info, Truck, Video, Globe, Mail, Phone, MapPin
} from 'lucide-react';
import { siteConfigApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

const inputCls = 'w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 transition-colors text-sm';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [config, setConfig] = useState({});

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await siteConfigApi.getConfig();
      
      const parsedConfig = {};
      Object.entries(response?.config || {}).forEach(([k, v]) => {
        parsedConfig[k] = v.value;
      });
      setConfig(parsedConfig);
    } catch (err) {
      logger.error('fetchSettings error:', err);
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await siteConfigApi.updateConfig(config);
      showToast('Settings saved successfully');
    } catch (err) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#B76E79] animate-spin" />
        <span className="ml-3 text-[#EAE0D5]/60 font-cinzel">Loading Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm ${toast.type === 'error' ? 'bg-red-500/90' : 'bg-green-500/90'}`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
            Site Settings
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1 text-sm">Global configurations for your e-commerce platform</p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Store Info */}
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Globe className="w-5 h-5 text-[#B76E79]" />
            <h2 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>General Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Site Name</label>
              <input type="text" value={config.site_name || ''} onChange={e => handleChange('site_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Contact Email</label>
              <input type="email" value={config.contact_email || ''} onChange={e => handleChange('contact_email', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Contact Phone</label>
              <input type="text" value={config.contact_phone || ''} onChange={e => handleChange('contact_phone', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Store Currency</label>
              <input type="text" value={config.currency || 'INR'} onChange={e => handleChange('currency', e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Physical Address</label>
              <textarea value={config.address || ''} onChange={e => handleChange('address', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            </div>
          </div>
        </div>

        {/* Shipping Settings */}
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Truck className="w-5 h-5 text-[#B76E79]" />
            <h2 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Shipping Policy</h2>
          </div>

          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
            <p className="text-sm text-green-400 font-medium">
              ✓ All prices include shipping charges. No minimum order value required for free shipping.
            </p>
          </div>
        </div>

        {/* Multimedia Settings */}
        <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Video className="w-5 h-5 text-[#B76E79]" />
            <h2 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>Multimedia</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wider">Intro Video URL (R2/Direct Link)</label>
              <input type="text" value={config.intro_video_url || ''} onChange={e => handleChange('intro_video_url', e.target.value)} className={inputCls} placeholder="https://..." />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-[#0B0608]/60 border border-[#B76E79]/10 rounded-xl">
              <div>
                <p className="text-sm text-[#EAE0D5] font-medium">Intro Video Playback</p>
                <p className="text-xs text-[#EAE0D5]/40 mt-0.5">Enable or disable the introductory video on user&apos;s first visit</p>
              </div>
              <button 
                type="button"
                onClick={() => handleChange('intro_video_enabled', config.intro_video_enabled === 'true' ? 'false' : 'true')}
                className={`relative w-12 h-6 rounded-full transition-colors ${config.intro_video_enabled === 'true' ? 'bg-[#B76E79]' : 'bg-[#EAE0D5]/20'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.intro_video_enabled === 'true' ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#7A2F57] to-[#B76E79] text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-[#7A2F57]/20"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving Changes...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
