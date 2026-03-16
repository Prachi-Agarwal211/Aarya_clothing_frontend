'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Upload, Trash2, Edit, Save, X,
  AlertCircle, CheckCircle, Loader2, ExternalLink,
  Package, Plus, Eye, EyeOff, Image as ImageIcon,
  Info
} from 'lucide-react';
import { landingApi, productsApi, siteConfigApi } from '@/lib/adminApi';
import logger from '@/lib/logger';

const SECTIONS = [
  { id: 'hero',        name: 'Hero',         description: 'Laptop/Phone images + tagline', icon: '🎬' },
  { id: 'newArrivals', name: 'New Arrivals', description: 'Select products to feature',  icon: '✨' },
  { id: 'collections', name: 'Collections',  description: 'Auto-pulled from DB',         icon: '🗂️' },
  { id: 'about',       name: 'About',        description: 'Brand story & images',        icon: '📖' },
  { id: 'video',       name: 'Intro Video',  description: 'Full-screen intro video',     icon: '🎥' }
];

const SECTION_FIELDS = {
  hero: [
    { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Designed with Elegance, Worn with Confidence' },
  ],
  newArrivals: [
    { key: 'title',        label: 'Section Title', type: 'text',     placeholder: 'New Arrivals' },
    { key: 'subtitle',     label: 'Subtitle',      type: 'text',     placeholder: 'Discover our latest collection' },
  ],
  collections: [
    { key: 'title',        label: 'Section Title', type: 'text',     placeholder: 'Our Collections' },
  ],
  about: [
    { key: 'title',        label: 'Section Title', type: 'text',     placeholder: 'Our Story' },
    { key: 'story',        label: 'Brand Story',   type: 'textarea', placeholder: 'Aarya Clothing was founded...' },
  ],
};

const inputCls = 'w-full px-4 py-2.5 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 transition-colors text-sm';

export default function LandingPageConfig() {
  // State
  const [config, setConfig] = useState({});
  const [siteConfig, setSiteConfig] = useState({});
  const [images, setImages] = useState([]);
  const [landingProducts, setLandingProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('hero');
  const [toast, setToast] = useState(null);
  
  // Edit State
  const [editingSection, setEditingSection] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editingImage, setEditingImage] = useState(null);
  const [imageEditForm, setImageEditForm] = useState({});
  
  // Product Picker State
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerSelected, setPickerSelected] = useState([]);

  // Hero Image Device Variant State
  const [selectedDeviceVariant, setSelectedDeviceVariant] = useState('laptop');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const results = await Promise.allSettled([
        landingApi.getConfig(),
        landingApi.getImages(),
        landingApi.getLandingProducts('newArrivals'),
        productsApi.list({ limit: 200 }),
        siteConfigApi.getConfig(),
      ]);

      const [configRes, imagesRes, lpRes, allProdsRes, siteRes] = results;

      // Parse configs
      const parsedConfig = {};
      if (configRes.status === 'fulfilled') {
        (configRes.value?.sections || []).forEach(s => {
          parsedConfig[s.section] = {
            is_active: s.is_active,
            ...(typeof s.config === 'string' ? JSON.parse(s.config) : s.config || {})
          };
        });
      }
      setConfig(parsedConfig);
      
      // Parse site config
      const parsedSiteConfig = {};
      if (siteRes.status === 'fulfilled') {
        Object.entries(siteRes.value?.config || {}).forEach(([k, v]) => {
          parsedSiteConfig[k] = v.value;
        });
      }
      setSiteConfig(parsedSiteConfig);
      
      setImages(imagesRes.status === 'fulfilled' ? (imagesRes.value?.images || []) : []);
      setLandingProducts(lpRes.status === 'fulfilled' ? (lpRes.value?.products || []) : []);
      setAllProducts(allProdsRes.status === 'fulfilled' ? (allProdsRes.value?.products || allProdsRes.value || []) : []);
      
      if (results.every(r => r.status === 'rejected')) {
        throw new Error('All data requests failed');
      }
    } catch (err) {
      logger.error('fetchData error:', err);
      setError('Failed to load. Please check connection and retry.');
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────
  const handleEditSection = (sectionId) => {
    setEditingSection(sectionId);
    if (sectionId === 'video') {
      setEditForm({
        intro_video_url: siteConfig.intro_video_url || '',
        intro_video_enabled: siteConfig.intro_video_enabled !== 'false'
      });
    } else {
      setEditForm({ ...config[sectionId], is_active: config[sectionId]?.is_active !== false });
    }
  };

  const handleSaveSection = async () => {
    try {
      setSaving(true);
      
      if (editingSection === 'video') {
        await siteConfigApi.updateConfig({
          intro_video_url: editForm.intro_video_url,
          intro_video_enabled: editForm.intro_video_enabled ? 'true' : 'false'
        });
        setSiteConfig(prev => ({
          ...prev,
          intro_video_url: editForm.intro_video_url,
          intro_video_enabled: editForm.intro_video_enabled ? 'true' : 'false'
        }));
      } else {
        const { is_active, ...sectionConfig } = editForm;
        await landingApi.updateSection(editingSection, sectionConfig, is_active);
        setConfig(prev => ({ ...prev, [editingSection]: editForm }));
      }
      
      setEditingSection(null);
      showToast(`${SECTIONS.find(s => s.id === editingSection)?.name} saved`);
    } catch (err) {
      showToast('Failed to save section', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e, section) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('Max 10MB', 'error'); return; }
    
    const tempId = `temp-${Date.now()}`;
    const sectionImages = images.filter(i => i.section === section);
    
    setImages(prev => [...prev, {
      id: tempId, section, image_url: URL.createObjectURL(file),
      display_order: sectionImages.length, isUploading: true,
    }]);
    
    try {
      setUploading(true);
      // For hero section, include device_variant
      const metadata = {
        display_order: sectionImages.length,
      };
      if (section === 'hero') {
        metadata.device_variant = selectedDeviceVariant;
      }
      const result = await landingApi.uploadImage(file, section, metadata);
      setImages(prev => prev.map(img =>
        img.id === tempId ? { ...img, id: result.image_id, image_url: result.image_url, isUploading: false } : img
      ));
      showToast('Image uploaded');
    } catch (err) {
      setImages(prev => prev.filter(img => img.id !== tempId));
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!confirm('Delete this image?')) return;
    const snapshot = [...images];
    setImages(prev => prev.filter(i => i.id !== imageId));
    try {
      await landingApi.deleteImage(imageId);
      showToast('Image deleted');
    } catch (err) {
      setImages(snapshot);
      showToast('Failed to delete', 'error');
    }
  };

  const handleSaveImageEdit = async () => {
    if (!editingImage) return;
    try {
      setSaving(true);
      await landingApi.updateImage(editingImage.id, imageEditForm);
      setImages(prev => prev.map(img => 
        img.id === editingImage.id ? { ...img, ...imageEditForm } : img
      ));
      setEditingImage(null);
      showToast('Image updated');
    } catch (err) {
      showToast('Failed to update image', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLandingProducts = async () => {
    if (!pickerSelected.length) return;
    try {
      setSaving(true);
      for (const pid of pickerSelected) {
        await landingApi.addLandingProduct({
          section: 'newArrivals',
          product_id: pid,
          display_order: landingProducts.length,
          is_active: true,
        });
      }
      const lpData = await landingApi.getLandingProducts('newArrivals');
      setLandingProducts(lpData?.products || []);
      setShowProductPicker(false);
      setPickerSelected([]);
      setPickerSearch('');
      showToast(`Added ${pickerSelected.length} product(s)`);
    } catch (err) {
      showToast('Failed to add products', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLandingProduct = async (lpId) => {
    if (!confirm('Remove this product?')) return;
    const snapshot = [...landingProducts];
    setLandingProducts(prev => prev.filter(p => p.id !== lpId));
    try {
      await landingApi.deleteLandingProduct(lpId);
      showToast('Removed');
    } catch (err) {
      setLandingProducts(snapshot);
      showToast('Failed to remove', 'error');
    }
  };

  const handleToggleLandingProduct = async (lp) => {
    try {
      await landingApi.updateLandingProduct(lp.id, { is_active: !lp.is_active });
      setLandingProducts(prev => prev.map(p => p.id === lp.id ? { ...p, is_active: !p.is_active } : p));
    } catch (err) {
      showToast('Failed to update', 'error');
    }
  };

  // ── Derived Data ────────────────────────────────────────────────
  const activeSectionData = SECTIONS.find(s => s.id === activeSection);
  const activeSectionConfig = activeSection === 'video' 
    ? { intro_video_url: siteConfig.intro_video_url, intro_video_enabled: siteConfig.intro_video_enabled !== 'false' }
    : (config[activeSection] || {});
  const activeSectionImages = images.filter(i => i.section === activeSection);
  
  // For hero section, filter by device variant
  const heroLaptopImages = activeSection === 'hero' ? activeSectionImages.filter(i => !i.device_variant || i.device_variant === 'laptop') : [];
  const heroPhoneImages = activeSection === 'hero' ? activeSectionImages.filter(i => i.device_variant === 'phone') : [];
  
  const activeSectionProducts = activeSection === 'newArrivals' ? landingProducts : [];
  
  const filteredAllProducts = allProducts.filter(p => {
    if (landingProducts.some(lp => lp.product_id === p.id)) return false;
    if (!pickerSearch) return true;
    return p.name?.toLowerCase().includes(pickerSearch.toLowerCase());
  });

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
            Landing Page
          </h1>
          <p className="text-[#EAE0D5]/60 mt-1 text-sm">Configure homepage sections and manage images</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">
            <ExternalLink className="w-4 h-4" /> Preview
          </a>
          <button onClick={fetchData} disabled={loading}
            className="p-2 rounded-xl border border-[#B76E79]/20 text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#B76E79] animate-spin" />
          <span className="ml-3 text-[#EAE0D5]/60">Loading configuration…</span>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-red-300 text-sm">{error}</span>
          <button onClick={fetchData} className="ml-auto text-sm text-red-300 underline hover:text-red-200">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Section List */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#EAE0D5]/40 px-1 mb-3">Sections</p>
            {SECTIONS.map(s => {
              let isActive = true;
              if (s.id === 'video') isActive = siteConfig.intro_video_enabled !== 'false';
              else isActive = config[s.id]?.is_active !== false;
              
              const imgCount = images.filter(i => i.section === s.id).length;
              const hasImages = ['hero', 'about'].includes(s.id);
              
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${activeSection === s.id
                    ? 'bg-[#7A2F57]/20 border-[#B76E79]/40'
                    : 'bg-[#0B0608]/40 border-[#B76E79]/10 hover:border-[#B76E79]/30'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{s.icon}</span>
                      <div>
                        <p className="font-medium text-[#EAE0D5] text-sm">{s.name}</p>
                        <p className="text-xs text-[#EAE0D5]/40">{s.description}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-xs text-[#EAE0D5]/40">{isActive ? 'Active' : 'Inactive'}</span>
                    {hasImages && (
                      <span className="text-xs text-[#EAE0D5]/25 ml-auto">{imgCount} image{imgCount !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-2 space-y-5">
            {/* Config Card */}
            <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activeSectionData?.icon}</span>
                  <h2 className="text-base font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                    {activeSectionData?.name} Configuration
                  </h2>
                </div>
                {activeSection !== 'collections' && (
                  <button onClick={() => handleEditSection(activeSection)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[#B76E79]/20 rounded-lg text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors">
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>

              {activeSection === 'collections' ? (
                <div className="p-4 bg-[#B76E79]/5 border border-[#B76E79]/10 rounded-xl">
                  <p className="text-sm text-[#EAE0D5]">Collections are automatically pulled from the database.</p>
                  <p className="text-xs text-[#EAE0D5]/60 mt-1">To manage featured collections, use the Collections page.</p>
                </div>
              ) : Object.keys(activeSectionConfig).filter(k => k !== 'is_active').length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(activeSectionConfig).filter(([k]) => k !== 'is_active').map(([key, value]) => (
                    <div key={key} className={`bg-[#0B0608]/60 rounded-xl p-3 border border-[#B76E79]/10 ${key === 'story' ? 'sm:col-span-2' : ''}`}>
                      <p className="text-xs text-[#EAE0D5]/40 capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                      <p className={`text-sm text-[#EAE0D5] ${key === 'story' ? '' : 'truncate'}`}>
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (String(value) || '—')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Info className="w-8 h-8 text-[#B76E79]/30 mx-auto mb-2" />
                  <p className="text-sm text-[#EAE0D5]/40">No configuration set yet.</p>
                  <button onClick={() => handleEditSection(activeSection)}
                    className="mt-2 text-sm text-[#B76E79] hover:text-[#F2C29A] underline transition-colors">
                    Click to configure
                  </button>
                </div>
              )}
            </div>

            {/* Products Card — only for newArrivals */}
            {activeSection === 'newArrivals' && (
              <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                    Selected Products
                  </h2>
                  <button
                    onClick={() => { setShowProductPicker(true); setPickerSelected([]); setPickerSearch(''); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/50 transition-colors font-medium">
                    <Plus className="w-4 h-4" /> Add Products
                  </button>
                </div>

                {activeSectionProducts.length === 0 ? (
                  <div className="py-10 text-center">
                    <Package className="w-10 h-10 text-[#B76E79]/20 mx-auto mb-3" />
                    <p className="text-[#EAE0D5]/40 text-sm">No products selected yet.</p>
                    <p className="text-[#EAE0D5]/25 text-xs mt-1">Click &quot;Add Products&quot; to select products for this section.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSectionProducts.map((lp, idx) => (
                      <div key={lp.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        lp.is_active ? 'bg-[#0B0608]/60 border-[#B76E79]/10' : 'bg-[#0B0608]/30 border-[#B76E79]/5 opacity-50'
                      }`}>
                        <span className="text-xs text-[#EAE0D5]/30 w-5 text-center">{idx + 1}</span>
                        {lp.primary_image ? (
                          <img src={lp.primary_image} alt={lp.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-[#1a0f0a]" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[#1a0f0a] flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-[#B76E79]/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#EAE0D5] truncate font-medium">{lp.name}</p>
                          <p className="text-xs text-[#EAE0D5]/50">₹{lp.price}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleToggleLandingProduct(lp)}
                            title={lp.is_active ? 'Hide from landing' : 'Show on landing'}
                            className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 transition-colors">
                            {lp.is_active ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4 text-[#EAE0D5]/30" />}
                          </button>
                          <button onClick={() => handleRemoveLandingProduct(lp.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400/70 hover:text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Images Card — hero and about only */}
            {['hero', 'about'].includes(activeSection) && (
              <div className="bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/15 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <h2 className="text-base font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                    Images
                  </h2>
                  <div className="flex items-center gap-3">
                    {/* Device Variant Selector for Hero Section */}
                    {activeSection === 'hero' && (
                      <div className="flex items-center gap-1 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg p-1">
                        <button
                          onClick={() => setSelectedDeviceVariant('laptop')}
                          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                            selectedDeviceVariant === 'laptop'
                              ? 'bg-[#B76E79] text-white'
                              : 'text-[#EAE0D5]/60 hover:text-[#EAE0D5]'
                          }`}
                        >
                          Laptop
                        </button>
                        <button
                          onClick={() => setSelectedDeviceVariant('phone')}
                          className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                            selectedDeviceVariant === 'phone'
                              ? 'bg-[#B76E79] text-white'
                              : 'text-[#EAE0D5]/60 hover:text-[#EAE0D5]'
                          }`}
                        >
                          Phone (9:16)
                        </button>
                      </div>
                    )}
                    <label className={`flex items-center gap-2 px-3 py-1.5 text-sm bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/50 transition-colors cursor-pointer font-medium ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? 'Uploading…' : 'Upload Image'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => handleImageUpload(e, activeSection)}
                        className="hidden" disabled={uploading} />
                    </label>
                  </div>
                </div>

                {activeSection === 'hero' ? (
                  <div className="space-y-6">
                    {/* Laptop Images */}
                    <div>
                      <h3 className="text-sm font-medium text-[#F2C29A] mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        Laptop Images
                        <span className="text-xs text-[#EAE0D5]/40 ml-2">({heroLaptopImages.length})</span>
                      </h3>
                      {heroLaptopImages.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {heroLaptopImages.map(image => (
                            <div key={image.id}
                              className="relative aspect-video rounded-xl overflow-hidden bg-[#7A2F57]/10 group border border-[#B76E79]/10">
                              {image.image_url ? (
                                <img src={image.image_url} alt={image.title || 'Laptop image'}
                                  className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  {image.isUploading ? <Loader2 className="w-8 h-8 text-[#B76E79] animate-spin" /> : <ImageIcon className="w-8 h-8 text-[#B76E79]/30" />}
                                </div>
                              )}
                              {image.is_active === false && (
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500/80 rounded text-xs text-white">Hidden</div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="absolute bottom-0 left-0 right-0 p-2.5 flex items-center justify-between">
                                  <p className="text-xs text-white truncate max-w-[65%]">{image.title || '—'}</p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingImage(image);
                                        setImageEditForm({
                                          title: image.title || '',
                                          subtitle: image.subtitle || '',
                                          link_url: image.link_url || '',
                                          is_active: image.is_active !== false,
                                        });
                                      }}
                                      disabled={image.isUploading}
                                      className="p-1.5 bg-[#B76E79]/80 rounded-lg text-white hover:bg-[#B76E79] transition-colors disabled:opacity-50">
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteImage(image.id)} disabled={image.isUploading}
                                      className="p-1.5 bg-red-500/80 rounded-lg text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center border border-dashed border-[#B76E79]/20 rounded-xl">
                          <ImageIcon className="w-8 h-8 text-[#B76E79]/20 mx-auto mb-2" />
                          <p className="text-[#EAE0D5]/40 text-sm">No laptop images. Select &quot;Laptop&quot; and upload.</p>
                        </div>
                      )}
                    </div>

                    {/* Phone Images */}
                    <div>
                      <h3 className="text-sm font-medium text-[#F2C29A] mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400" />
                        Phone Images (9:16)
                        <span className="text-xs text-[#EAE0D5]/40 ml-2">({heroPhoneImages.length})</span>
                      </h3>
                      {heroPhoneImages.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {heroPhoneImages.map(image => (
                            <div key={image.id}
                              className="relative aspect-[9/16] rounded-xl overflow-hidden bg-[#7A2F57]/10 group border border-[#B76E79]/10">
                              {image.image_url ? (
                                <img src={image.image_url} alt={image.title || 'Phone image'}
                                  className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  {image.isUploading ? <Loader2 className="w-8 h-8 text-[#B76E79] animate-spin" /> : <ImageIcon className="w-8 h-8 text-[#B76E79]/30" />}
                                </div>
                              )}
                              {image.is_active === false && (
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500/80 rounded text-xs text-white">Hidden</div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="absolute bottom-0 left-0 right-0 p-2.5 flex items-center justify-between">
                                  <p className="text-xs text-white truncate max-w-[65%]">{image.title || '—'}</p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingImage(image);
                                        setImageEditForm({
                                          title: image.title || '',
                                          subtitle: image.subtitle || '',
                                          link_url: image.link_url || '',
                                          is_active: image.is_active !== false,
                                        });
                                      }}
                                      disabled={image.isUploading}
                                      className="p-1.5 bg-[#B76E79]/80 rounded-lg text-white hover:bg-[#B76E79] transition-colors disabled:opacity-50">
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDeleteImage(image.id)} disabled={image.isUploading}
                                      className="p-1.5 bg-red-500/80 rounded-lg text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-8 text-center border border-dashed border-[#B76E79]/20 rounded-xl">
                          <ImageIcon className="w-8 h-8 text-[#B76E79]/20 mx-auto mb-2" />
                          <p className="text-[#EAE0D5]/40 text-sm">No phone images. Select &quot;Phone (9:16)&quot; and upload.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : activeSectionImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {activeSectionImages.map(image => (
                      <div key={image.id}
                        className="relative aspect-video rounded-xl overflow-hidden bg-[#7A2F57]/10 group border border-[#B76E79]/10">
                        {image.image_url ? (
                          <img src={image.image_url} alt={image.title || 'Landing image'}
                            className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            {image.isUploading ? <Loader2 className="w-8 h-8 text-[#B76E79] animate-spin" /> : <ImageIcon className="w-8 h-8 text-[#B76E79]/30" />}
                          </div>
                        )}
                        {image.is_active === false && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500/80 rounded text-xs text-white">Hidden</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2.5 flex items-center justify-between">
                            <p className="text-xs text-white truncate max-w-[65%]">{image.title || '—'}</p>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingImage(image);
                                  setImageEditForm({
                                    title: image.title || '',
                                    subtitle: image.subtitle || '',
                                    link_url: image.link_url || '',
                                    is_active: image.is_active !== false,
                                  });
                                }}
                                disabled={image.isUploading}
                                className="p-1.5 bg-[#B76E79]/80 rounded-lg text-white hover:bg-[#B76E79] transition-colors disabled:opacity-50">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteImage(image.id)} disabled={image.isUploading}
                                className="p-1.5 bg-red-500/80 rounded-lg text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activeSectionImages.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {activeSectionImages.map(image => (
                      <div key={image.id}
                        className="relative aspect-video rounded-xl overflow-hidden bg-[#7A2F57]/10 group border border-[#B76E79]/10">
                        {image.image_url ? (
                          <img src={image.image_url} alt={image.title || 'Landing image'}
                            className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            {image.isUploading ? <Loader2 className="w-8 h-8 text-[#B76E79] animate-spin" /> : <ImageIcon className="w-8 h-8 text-[#B76E79]/30" />}
                          </div>
                        )}
                        {image.is_active === false && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500/80 rounded text-xs text-white">Hidden</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-2.5 flex items-center justify-between">
                            <p className="text-xs text-white truncate max-w-[65%]">{image.title || '—'}</p>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingImage(image);
                                  setImageEditForm({
                                    title: image.title || '',
                                    subtitle: image.subtitle || '',
                                    link_url: image.link_url || '',
                                    is_active: image.is_active !== false,
                                  });
                                }}
                                disabled={image.isUploading}
                                className="p-1.5 bg-[#B76E79]/80 rounded-lg text-white hover:bg-[#B76E79] transition-colors disabled:opacity-50">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteImage(image.id)} disabled={image.isUploading}
                                className="p-1.5 bg-red-500/80 rounded-lg text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <ImageIcon className="w-12 h-12 text-[#B76E79]/20 mx-auto mb-3" />
                    <p className="text-[#EAE0D5]/40 text-sm">No images for this section yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section Edit Modal */}
      {editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingSection(null)} />
          <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">{SECTIONS.find(s => s.id === editingSection)?.icon}</span>
                <h3 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                  Edit {SECTIONS.find(s => s.id === editingSection)?.name}
                </h3>
              </div>
              <button onClick={() => setEditingSection(null)}
                className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 transition-colors">
                <X className="w-5 h-5 text-[#EAE0D5]/60" />
              </button>
            </div>

            <div className="space-y-4">
              {editingSection === 'video' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wide">Video URL</label>
                    <input type="text" value={editForm.intro_video_url || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, intro_video_url: e.target.value }))}
                      className={inputCls} placeholder="https://..." />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-[#0B0608]/60 border border-[#B76E79]/15 rounded-xl">
                    <div>
                      <p className="text-sm text-[#EAE0D5]">Show Intro Video</p>
                      <p className="text-xs text-[#EAE0D5]/40">Play video on first visit</p>
                    </div>
                    <button onClick={() => setEditForm(prev => ({ ...prev, intro_video_enabled: !prev.intro_video_enabled }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${editForm.intro_video_enabled ? 'bg-[#B76E79]' : 'bg-[#EAE0D5]/20'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.intro_video_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {(SECTION_FIELDS[editingSection] || []).map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wide">
                        {field.label}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea value={editForm[field.key] || ''} rows={4}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className={`${inputCls} resize-none`} placeholder={field.placeholder} />
                      ) : (
                        <input type={field.type || 'text'} value={editForm[field.key] || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className={inputCls} placeholder={field.placeholder} />
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-[#0B0608]/60 border border-[#B76E79]/15 rounded-xl">
                    <div>
                      <p className="text-sm text-[#EAE0D5]">Section Active</p>
                      <p className="text-xs text-[#EAE0D5]/40">Show this section on the landing page</p>
                    </div>
                    <button onClick={() => setEditForm(prev => ({ ...prev, is_active: prev.is_active === false ? true : false }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${editForm.is_active !== false ? 'bg-[#B76E79]' : 'bg-[#EAE0D5]/20'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editForm.is_active !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingSection(null)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleSaveSection} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/50 transition-colors text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Picker Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowProductPicker(false)} />
          <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                Add Products to New Arrivals
              </h3>
              <button onClick={() => setShowProductPicker(false)}
                className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 transition-colors">
                <X className="w-5 h-5 text-[#EAE0D5]/60" />
              </button>
            </div>

            <input
              type="text"
              placeholder="Search products…"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="w-full px-4 py-2.5 mb-4 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:border-[#B76E79]/50 text-sm"
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredAllProducts.length === 0 ? (
                <p className="text-center text-[#EAE0D5]/40 py-8 text-sm">No products found</p>
              ) : filteredAllProducts.map(p => {
                const isSelected = pickerSelected.includes(p.id);
                const img = p.primary_image || p.image_url || '';
                return (
                  <button key={p.id} onClick={() => setPickerSelected(prev =>
                    isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]
                  )}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#7A2F57]/20 border-[#B76E79]/40'
                        : 'bg-[#0B0608]/40 border-[#B76E79]/10 hover:border-[#B76E79]/30'
                    }`}>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-[#B76E79] border-[#B76E79]' : 'border-[#B76E79]/30'
                    }`}>
                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    {img ? (
                      <img src={img} alt={p.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-[#1a0f0a]" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#1a0f0a] flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-[#B76E79]/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#EAE0D5] truncate font-medium">{p.name}</p>
                      <p className="text-xs text-[#EAE0D5]/50">₹{p.price}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t border-[#B76E79]/10">
              <button onClick={() => setShowProductPicker(false)}
                className="flex-1 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleAddLandingProducts} disabled={!pickerSelected.length || saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/50 transition-colors text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add {pickerSelected.length > 0 ? `${pickerSelected.length} ` : ''}Product{pickerSelected.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Edit Modal */}
      {editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditingImage(null)} />
          <div className="relative bg-[#0B0608]/95 backdrop-blur-xl border border-[#B76E79]/20 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-[#F2C29A]" style={{ fontFamily: 'Cinzel, serif' }}>
                Edit Image
              </h3>
              <button onClick={() => setEditingImage(null)}
                className="p-1.5 rounded-lg hover:bg-[#B76E79]/10 transition-colors">
                <X className="w-5 h-5 text-[#EAE0D5]/60" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wide">Title</label>
                <input type="text" value={imageEditForm.title || ''}
                  onChange={(e) => setImageEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className={inputCls} placeholder="Image title" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wide">Subtitle</label>
                <textarea value={imageEditForm.subtitle || ''} rows={2}
                  onChange={(e) => setImageEditForm(prev => ({ ...prev, subtitle: e.target.value }))}
                  className={`${inputCls} resize-none`} placeholder="Optional subtitle" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#EAE0D5]/60 mb-1.5 uppercase tracking-wide">Link URL</label>
                <input type="text" value={imageEditForm.link_url || ''}
                  onChange={(e) => setImageEditForm(prev => ({ ...prev, link_url: e.target.value }))}
                  className={inputCls} placeholder="/products or https://..." />
              </div>

              <div className="flex items-center justify-between p-3 bg-[#0B0608]/60 border border-[#B76E79]/15 rounded-xl">
                <div>
                  <p className="text-sm text-[#EAE0D5]">Image Active</p>
                  <p className="text-xs text-[#EAE0D5]/40">Show this image on the landing page</p>
                </div>
                <button onClick={() => setImageEditForm(prev => ({ ...prev, is_active: !prev.is_active }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${imageEditForm.is_active !== false ? 'bg-[#B76E79]' : 'bg-[#EAE0D5]/20'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${imageEditForm.is_active !== false ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingImage(null)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-[#B76E79]/20 rounded-xl text-[#EAE0D5]/70 hover:bg-[#B76E79]/10 transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleSaveImageEdit} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7A2F57]/30 border border-[#B76E79]/30 rounded-xl text-[#F2C29A] hover:bg-[#7A2F57]/50 transition-colors text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
