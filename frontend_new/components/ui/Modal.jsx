'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { reviewsApi as reviewsApiClient } from '@/lib/customerApi';

/**
 * Helper to ensure image URL is complete.
 * Backend should return full URLs, but this provides a safety net.
 */
function ensureFullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
}

/**
 * Modal - Premium modal component with animations
 * 
 * Features:
 * - Portal rendering
 * - Keyboard navigation (Escape to close)
 * - Click outside to close
 * - Smooth animations
 * - Focus trap
 * - Multiple sizes
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
  overlayClassName,
}) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Handle escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && closeOnEscape) {
      onClose?.();
    }
  }, [closeOnEscape, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget && closeOnOverlayClick) {
      onClose?.();
    }
  }, [closeOnOverlayClick, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      modalRef.current?.focus();
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] max-h-[95vh]',
  };

  const modalContent = (
    <div
      className={cn(
        'modal-overlay',
        overlayClassName
      )}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'modal-content',
          sizes[size],
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && (
              <h2 id="modal-title" className="modal-title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="modal-close"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

/**
 * QuickViewModal - Compact product quick view modal with description and reviews
 */
export const QuickViewModal = ({
  isOpen,
  onClose,
  product,
  onAddToCart,
  onWishlist,
}) => {
  const [selectedSize, setSelectedSize] = React.useState('');
  const [selectedColor, setSelectedColor] = React.useState('Black');
  const [quantity, setQuantity] = React.useState(1);
  const [activeTab, setActiveTab] = React.useState('description');
  const [showReviewForm, setShowReviewForm] = React.useState(false);
  const [reviewForm, setReviewForm] = React.useState({
    rating: 5,
    name: '',
    comment: ''
  });
  const [reviews, setReviews] = React.useState([]);
  const [isLoadingReviews, setIsLoadingReviews] = React.useState(false);
  const [submittedReview, setSubmittedReview] = React.useState(false);
  const [reviewError, setReviewError] = React.useState(null);

  // Fetch reviews from backend
  React.useEffect(() => {
    const fetchReviews = async () => {
      if (!product?.id) return;
      
      setIsLoadingReviews(true);
      try {
        const result = reviewsApiClient.list(product.id, { limit: 10 });
        setReviews(result.reviews || result || []);
      } catch (e) {
        console.warn('Failed to fetch reviews:', e.message);
        setReviews([]);
      } finally {
        setIsLoadingReviews(false);
      }
    };
    
    fetchReviews();
  }, [product?.id]);

  // Initialize reviews from product data if available
  React.useEffect(() => {
    if (product && !reviews.length) {
      setReviews(product.reviews || []);
    }
  }, [product]);

  if (!product) return null;

  const handleAddToCart = () => {
    if (onAddToCart) {
      // Find matching variant
      const variant = product.inventory?.find(
        v => v.size === selectedSize && (!selectedColor || v.color === selectedColor)
      );
      
      onAddToCart({ 
        ...product, 
        size: selectedSize, 
        quantity, 
        color: selectedColor,
        inventory: product.inventory // Pass inventory so parent can double check if needed
      });
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (reviewForm.name && reviewForm.comment) {
      try {
        // Try to save review to backend
        await reviewsApiClient.create(product.id, {
          rating: reviewForm.rating,
          title: reviewForm.name,
          comment: reviewForm.comment
        });
        
        // Refresh reviews from backend
        const result = await reviewsApiClient.list(product.id, { limit: 10 });
        setReviews(result.reviews || result || []);
      } catch (e) {
        console.warn('Failed to submit review to backend:', e.message);
        // Fall back to local state update
        const newReview = {
          id: Date.now(),
          user: reviewForm.name,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          date: new Date().toISOString().split('T')[0],
          helpful: 0
        };
        setReviews([newReview, ...reviews]);
      }
      
      setReviewForm({ rating: 5, name: '', comment: '' });
      setShowReviewForm(false);
      setSubmittedReview(true);
      setTimeout(() => setSubmittedReview(false), 3000);
    }
  };

  const colors = [
    { name: 'Black', value: '#000000' },
    { name: 'Burgundy', value: '#722F37' },
    { name: 'Navy', value: '#1e3a5f' },
  ];

  const sizes = product.sizes || ['XS', 'S', 'M', 'L', 'XL'];
  
  // Calculate average rating
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="quick-view-modal"
      showCloseButton={false}
    >
      <div className="flex flex-col md:flex-row max-h-[90vh]">
        {/* Product Image Section */}
        <div className="md:w-1/2 relative bg-gradient-to-br from-[#0B0608] to-[#1A0F0F] flex-shrink-0">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-[#0B0608]/60 backdrop-blur-sm border border-[#B76E79]/20 text-[#EAE0D5] hover:text-[#F2C29A] hover:border-[#F2C29A]/50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* New Badge */}
          {product.is_new && (
            <span className="absolute top-3 left-3 z-10 px-2 py-0.5 bg-gradient-to-r from-[#F2C29A] to-[#EAE0D5] text-[#050203] text-xs font-semibold tracking-wider rounded-full">
              NEW
            </span>
          )}

          {/* Main Image */}
          <div className="aspect-[3/4] md:h-full md:max-h-[90vh] relative">
            <img
              src={ensureFullUrl(product.image || product.images?.[0])}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050203]/30 via-transparent to-transparent" />
          </div>
        </div>

        {/* Product Info Section - Scrollable */}
        <div className="md:w-1/2 flex flex-col max-h-[90vh]">
          {/* Fixed Header Section */}
          <div className="p-5 md:p-6 pb-0 flex-shrink-0">
            {/* Header */}
            <div className="mb-3">
              <p className="text-[#B76E79] text-xs font-medium uppercase tracking-[0.15em] mb-1">
                {product.category}
              </p>
              <h3 className="text-xl md:text-2xl font-cinzel text-[#EAE0D5] leading-tight">
                {product.name}
              </h3>
            </div>

            {/* Rating & Price Row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${i < Math.round(parseFloat(avgRating)) ? 'text-yellow-400 fill-yellow-400' : 'text-[#EAE0D5]/20'}`}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  ))}
                  <span className="text-sm text-[#EAE0D5]/70 ml-1">({reviews.length})</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-medium text-[#F2C29A]">
                  ₹{(product.price || product.originalPrice)?.toLocaleString()}
                </span>
                {product.mrp && product.mrp > product.price && (
                  <>
                    <span className="text-sm text-[#8B7B8F] line-through">
                      ₹{product.mrp?.toLocaleString()}
                    </span>
                    <span className="px-1.5 py-0.5 text-xs font-medium text-white bg-[#7A2F57] rounded">
                      {Math.round((1 - product.price / product.mrp) * 100)}% OFF
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 md:px-6 scrollbar-premium">
            {/* Tabs */}
            <div className="flex gap-4 border-b border-[#B76E79]/15 mb-4 sticky top-0 bg-gradient-to-b from-[#0B0608] to-[#0B0608]/95 pt-2 z-10">
              <button
                onClick={() => setActiveTab('description')}
                className={`pb-2 text-sm font-medium transition-colors ${
                  activeTab === 'description'
                    ? 'text-[#F2C29A] border-b-2 border-[#B76E79]'
                    : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]'
                }`}
              >
                Description
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`pb-2 text-sm font-medium transition-colors ${
                  activeTab === 'reviews'
                    ? 'text-[#F2C29A] border-b-2 border-[#B76E79]'
                    : 'text-[#EAE0D5]/50 hover:text-[#EAE0D5]'
                }`}
              >
                Reviews ({reviews.length})
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'description' ? (
              <div className="space-y-4 pb-4">
                {/* Description */}
                <div>
                  <p className="text-[#EAE0D5]/80 text-sm leading-relaxed">
                    {product.description || 'Elegant and sophisticated, this piece is crafted with premium quality materials. Perfect for special occasions and celebrations. The intricate design and attention to detail make it a must-have for your wardrobe.'}
                  </p>
                </div>

                {/* Product Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-[#0B0608]/40 rounded-lg p-3">
                    <p className="text-[#EAE0D5]/50 text-xs mb-1">Material</p>
                    <p className="text-[#EAE0D5]">{product.material || 'Premium Quality'}</p>
                  </div>
                  <div className="bg-[#0B0608]/40 rounded-lg p-3">
                    <p className="text-[#EAE0D5]/50 text-xs mb-1">Care</p>
                    <p className="text-[#EAE0D5]">{product.care || 'Dry Clean'}</p>
                  </div>
                </div>

                {/* Size Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[#EAE0D5] font-medium">
                      Size: <span className="text-[#F2C29A]">{selectedSize || 'Select'}</span>
                    </p>
                    <button className="text-xs text-[#B76E79] hover:text-[#F2C29A] transition-colors underline underline-offset-2">
                      Size Guide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`min-w-[40px] h-9 px-2 rounded-lg border text-xs font-medium transition-all ${
                          selectedSize === size
                            ? 'border-[#F2C29A] bg-[#F2C29A] text-[#050203]'
                            : 'border-[#3D2C35] text-[#EAE0D5] hover:border-[#B76E79] hover:bg-[#3D2C35]/30'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Selection */}
                <div>
                  <p className="text-xs text-[#EAE0D5] font-medium mb-2">
                    Color: <span className="text-[#F2C29A]">{selectedColor}</span>
                  </p>
                  <div className="flex gap-2">
                    {colors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setSelectedColor(color.name)}
                        className={`w-8 h-8 rounded-full transition-all ${
                          selectedColor === color.name
                            ? 'ring-2 ring-[#F2C29A] ring-offset-2 ring-offset-[#0B0608]'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <p className="text-xs text-[#EAE0D5] font-medium mb-2">Quantity</p>
                  <div className="inline-flex items-center border border-[#3D2C35] rounded-lg overflow-hidden">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 text-[#EAE0D5] hover:bg-[#3D2C35]/30 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="w-12 text-center text-[#EAE0D5] font-medium">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 text-[#EAE0D5] hover:bg-[#3D2C35]/30 transition-colors flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {/* Review Summary */}
                <div className="flex items-center gap-4 p-3 bg-[#0B0608]/40 rounded-xl">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[#F2C29A]">{avgRating}</p>
                    <div className="flex items-center justify-center gap-0.5 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`w-3 h-3 ${i < Math.round(parseFloat(avgRating)) ? 'text-yellow-400 fill-yellow-400' : 'text-[#EAE0D5]/20'}`}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-xs text-[#EAE0D5]/50 mt-1">{reviews.length} reviews</p>
                  </div>
                  <button 
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className="ml-auto px-3 py-1.5 bg-[#7A2F57]/30 text-[#F2C29A] rounded-lg hover:bg-[#7A2F57]/40 transition-colors text-sm"
                  >
                    Write a Review
                  </button>
                </div>

                {/* Success Message */}
                {submittedReview && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
                    Thank you! Your review has been submitted.
                  </div>
                )}

                {/* Review Form */}
                {showReviewForm && (
                  <form onSubmit={handleSubmitReview} className="p-4 bg-[#0B0608]/40 rounded-xl space-y-3">
                    <h4 className="text-sm font-medium text-[#F2C29A]">Write Your Review</h4>
                    
                    {/* Rating */}
                    <div>
                      <p className="text-xs text-[#EAE0D5]/70 mb-2">Rating</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                            className="p-1"
                          >
                            <svg
                              className={`w-6 h-6 transition-colors ${
                                star <= reviewForm.rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#EAE0D5]/30'
                              }`}
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Name */}
                    <div>
                      <input
                        type="text"
                        placeholder="Your Name"
                        value={reviewForm.name}
                        onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm"
                        required
                      />
                    </div>

                    {/* Comment */}
                    <div>
                      <textarea
                        placeholder="Write your review..."
                        value={reviewForm.comment}
                        onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder-[#EAE0D5]/40 focus:outline-none focus:border-[#B76E79]/40 text-sm resize-none"
                        rows={3}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-gradient-to-r from-[#B76E79] to-[#7A2F57] text-white rounded-lg font-medium text-sm hover:shadow-[0_0_20px_rgba(183,110,121,0.4)] transition-all"
                    >
                      Submit Review
                    </button>
                  </form>
                )}

                {/* Reviews List */}
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-3 bg-[#0B0608]/40 rounded-xl">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-[#EAE0D5] text-sm">{review.user}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-3 h-3 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-[#EAE0D5]/20'}`}
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-[#EAE0D5]/50">{review.date}</span>
                      </div>
                      <p className="text-[#EAE0D5]/70 text-sm">{review.comment}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <button className="flex items-center gap-1 text-xs text-[#EAE0D5]/50 hover:text-[#EAE0D5]">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Helpful ({review.helpful})
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fixed Actions Section */}
          <div className="p-5 md:p-6 pt-4 border-t border-[#B76E79]/15 flex-shrink-0 bg-gradient-to-t from-[#0B0608] to-[#0B0608]/95">
            <div className="flex gap-2 mb-3">
              <button
                onClick={handleAddToCart}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#B76E79] to-[#7A2F57] text-white rounded-xl font-medium hover:shadow-[0_0_20px_rgba(183,110,121,0.4)] transition-all active:scale-[0.98] text-sm"
              >
                Add to Cart — ₹{((product.price || 0) * quantity)?.toLocaleString()}
              </button>
              <button
                onClick={() => onWishlist?.(product)}
                className="p-3 border border-[#3D2C35] rounded-xl text-[#B76E79] hover:border-[#B76E79] hover:text-[#F2C29A] transition-all hover:bg-[#3D2C35]/20"
                title="Add to Wishlist"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>

            {/* Quick Info */}
            <div className="flex items-center justify-center gap-4 text-xs text-[#EAE0D5]/60">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#B76E79]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Free Shipping
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-[#B76E79]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Easy Returns
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default Modal;
