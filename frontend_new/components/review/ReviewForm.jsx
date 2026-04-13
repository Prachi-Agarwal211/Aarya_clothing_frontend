'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Star, Upload, X, Image as ImageIcon, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { customerApi } from '@/lib/customerApi';
import logger from '@/lib/logger';

/**
 * ReviewForm - Component for writing product reviews with image upload
 * 
 * Features:
 * - Star rating (1-5, required)
 * - Optional title and comment
 * - Image upload support (max 5 images)
 * - Form validation
 * - Success/error states
 * - Mobile-responsive design
 */
export default function ReviewForm({ productId, onSuccess, onCancel }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const fileInputRef = useRef(null);
  const MAX_IMAGES = 5;
  const MAX_FILE_SIZE_MB = 5;

  // Handle star rating click
  const handleRatingClick = useCallback((value) => {
    setRating(value);
    setError('');
  }, []);

  // Handle image selection
  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    
    if (images.length + files.length > MAX_IMAGES) {
      setError(`You can upload maximum ${MAX_IMAGES} images`);
      return;
    }

    const validFiles = [];
    const previews = [];

    files.forEach(file => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`File size must be less than ${MAX_FILE_SIZE_MB}MB`);
        return;
      }

      validFiles.push(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result);
        if (previews.length === validFiles.length) {
          setImagePreviews(prev => [...prev, ...previews]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (validFiles.length > 0) {
      setImages(prev => [...prev, ...validFiles]);
      setError('');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [images]);

  // Remove image
  const removeImage = useCallback((index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Submit review
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    // Validation
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (comment.trim().length < 10) {
      setError('Please write at least 10 characters in your review');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      let imageUrls = [];

      // Upload images if any
      if (images.length > 0) {
        try {
          const uploadPromises = images.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            // Upload to review images endpoint
            const response = await customerApi.reviews.uploadImage(productId, formData);
            return response.url;
          });

          imageUrls = await Promise.all(uploadPromises);
          logger.info(`Uploaded ${imageUrls.length} images for review`);
        } catch (uploadError) {
          logger.warn('Image upload failed, continuing without images:', uploadError.message);
          // Continue without images - not a blocker
        }
      }

      // Submit review
      await customerApi.reviews.create({
        product_id: productId,
        rating,
        title: title.trim() || undefined,
        comment: comment.trim(),
        image_urls: imageUrls,
      });

      setSuccess(true);
      logger.info('Review submitted successfully');

      // Call success callback after short delay
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);

    } catch (err) {
      logger.error('Failed to submit review:', err);
      
      // Handle specific error messages
      if (err.message?.includes('already reviewed')) {
        setError('You have already reviewed this product. You can only submit one review per product.');
      } else if (err.status === 401) {
        setError('Please login to write a review');
      } else {
        setError(err.message || 'Failed to submit review. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [productId, rating, title, comment, images, onSuccess]);

  // If success, show success message
  if (success) {
    return (
      <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-green-400 mb-2">Review Submitted!</h3>
        <p className="text-green-300/80 text-sm">
          Thank you for your review. It will be visible after moderator approval.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-[#0B0608]/60 border border-[#B76E79]/20 rounded-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-[#EAE0D5]" style={{ fontFamily: 'Cinzel, serif' }}>
          Write a Review
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 text-[#EAE0D5]/50 hover:text-[#EAE0D5] transition-colors"
            aria-label="Close review form"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-[#EAE0D5]/80 mb-2">
            Rating <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-2" role="radiogroup" aria-label="Product rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRatingClick(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#F2C29A] rounded"
                aria-label={`Rate ${star} out of 5 stars`}
                role="radio"
                aria-checked={rating === star}
              >
                <Star
                  className={`w-8 h-8 transition-colors ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-[#EAE0D5]/20'
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-[#EAE0D5]/60">
                {rating} / 5
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="review-title" className="block text-sm font-medium text-[#EAE0D5]/80 mb-2">
            Review Title <span className="text-[#EAE0D5]/40">(optional)</span>
          </label>
          <input
            id="review-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summarize your experience"
            maxLength={100}
            className="w-full px-4 py-2.5 bg-[#1A1114]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:ring-2 focus:ring-[#F2C29A]/50 focus:border-[#F2C29A]/50 transition-all"
          />
        </div>

        {/* Comment */}
        <div>
          <label htmlFor="review-comment" className="block text-sm font-medium text-[#EAE0D5]/80 mb-2">
            Your Review <span className="text-red-400">*</span>
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us about your experience with this product..."
            rows={5}
            minLength={10}
            maxLength={2000}
            required
            className="w-full px-4 py-2.5 bg-[#1A1114]/60 border border-[#B76E79]/20 rounded-lg text-[#EAE0D5] placeholder:text-[#EAE0D5]/30 focus:outline-none focus:ring-2 focus:ring-[#F2C29A]/50 focus:border-[#F2C29A]/50 transition-all resize-none"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-[#EAE0D5]/40">Minimum 10 characters</span>
            <span className="text-xs text-[#EAE0D5]/40">{comment.length} / 2000</span>
          </div>
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-[#EAE0D5]/80 mb-2">
            Add Photos <span className="text-[#EAE0D5]/40">(optional, max {MAX_IMAGES})</span>
          </label>
          
          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove image ${index + 1}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border-2 border-dashed border-[#B76E79]/30 rounded-lg text-[#EAE0D5]/50 hover:text-[#EAE0D5] hover:border-[#B76E79]/50 transition-all flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              <span>
                {images.length === 0 ? 'Upload photos' : `Add more photos (${MAX_IMAGES - images.length} left)`}
              </span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
            aria-label="Upload review photos"
          />

          <p className="text-xs text-[#EAE0D5]/40 mt-2">
            JPG, PNG or WebP • Max {MAX_FILE_SIZE_MB}MB per file
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2" role="alert">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isSubmitting || rating === 0}
          className="w-full h-11 relative overflow-hidden rounded-xl bg-transparent border border-[#B76E79]/40 group transition-all duration-500 hover:border-[#F2C29A]/60 hover:shadow-[0_0_30px_rgba(183,110,121,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#7A2F57]/80 via-[#B76E79]/70 to-[#2A1208]/80 opacity-90"></div>
          <span className="relative z-10 text-white font-serif tracking-[0.12em] text-base">
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </span>
        </Button>

        <p className="text-xs text-[#EAE0D5]/40 text-center">
          Your review will be visible after moderator approval
        </p>
      </form>
    </div>
  );
}
