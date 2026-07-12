'use client';

import React, { useMemo, useState, useCallback } from 'react';
import Image from 'next/image';
import { Star, ThumbsUp, BadgeCheck, ImageIcon, ChevronDown, MessageSquarePlus } from 'lucide-react';
import ReviewForm from '@/components/review/ReviewForm';
import { reviewsApi } from '@/lib/customerApi';
import { useAuth } from '@/lib/authContext';
import { usePathname, useRouter } from 'next/navigation';
import logger from '@/lib/logger';

function Stars({ value = 0, size = 'sm', className = '' }) {
  const px = size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const n = Math.round(Number(value) || 0);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${px} ${s <= n ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-white/15'}`}
        />
      ))}
    </span>
  );
}

function displayName(review) {
  return (
    review.user_name ||
    review.user ||
    review.customer_name ||
    (review.user_id ? `Customer` : 'Anonymous')
  );
}

function normalizeReviews(list) {
  if (!Array.isArray(list)) return [];
  return list.map((r) => ({
    ...r,
    images: r.image_urls || r.images || [],
  }));
}

/**
 * ProductReviews — rating summary, histogram, sort, helpful, photos, write form.
 */
export default function ProductReviews({
  productId,
  productRating,
  reviewsCount,
  initialReviews = [],
  onReviewsChange,
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [reviews, setReviews] = useState(() => normalizeReviews(initialReviews));
  const [showForm, setShowForm] = useState(false);
  const [sort, setSort] = useState('newest'); // newest | highest | helpful
  const [filterStar, setFilterStar] = useState(0); // 0 = all
  const [helpfulBusy, setHelpfulBusy] = useState({});
  const [lightbox, setLightbox] = useState(null);

  React.useEffect(() => {
    setReviews(normalizeReviews(initialReviews));
  }, [initialReviews]);

  const stats = useMemo(() => {
    const list = reviews;
    const count = list.length || reviewsCount || 0;
    const sum = list.reduce((a, r) => a + (Number(r.rating) || 0), 0);
    const avg =
      list.length > 0
        ? sum / list.length
        : Number(productRating) || 0;
    const buckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    list.forEach((r) => {
      const k = Math.min(5, Math.max(1, Math.round(Number(r.rating) || 0)));
      buckets[k] += 1;
    });
    return { count, avg, buckets };
  }, [reviews, productRating, reviewsCount]);

  const sorted = useMemo(() => {
    let list = [...reviews];
    if (filterStar > 0) {
      list = list.filter((r) => Math.round(Number(r.rating) || 0) === filterStar);
    }
    if (sort === 'highest') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'helpful') {
      list.sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0));
    } else {
      list.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }
    return list;
  }, [reviews, sort, filterStar]);

  const photoReviews = useMemo(
    () => reviews.filter((r) => (r.images || []).length > 0).slice(0, 12),
    [reviews]
  );

  const handleWriteClick = () => {
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect_url=${encodeURIComponent(pathname + '#reviews')}`);
      return;
    }
    setShowForm((v) => !v);
  };

  const handleSuccess = async () => {
    setShowForm(false);
    try {
      const data = await reviewsApi.list(productId);
      const next = normalizeReviews(Array.isArray(data) ? data : data?.reviews || []);
      setReviews(next);
      onReviewsChange?.(next);
    } catch (err) {
      logger.error('Reload reviews failed', err);
    }
  };

  const markHelpful = useCallback(
    async (reviewId) => {
      if (!reviewId || helpfulBusy[reviewId]) return;
      const key = `helpful_${reviewId}`;
      if (typeof window !== 'undefined' && localStorage.getItem(key)) return;
      setHelpfulBusy((p) => ({ ...p, [reviewId]: true }));
      try {
        await reviewsApi.markHelpful(reviewId);
        if (typeof window !== 'undefined') localStorage.setItem(key, '1');
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, helpful_count: (r.helpful_count || 0) + 1 }
              : r
          )
        );
      } catch (err) {
        logger.warn('Helpful vote failed', err?.message);
      } finally {
        setHelpfulBusy((p) => ({ ...p, [reviewId]: false }));
      }
    },
    [helpfulBusy]
  );

  return (
    <section id="reviews" className="scroll-mt-28 space-y-6 sm:space-y-8">
      {/* Summary card */}
      <div className="panel-matte rounded-2xl p-5 sm:p-6 md:p-8 border border-white/[0.06]">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8">
          <div className="text-center lg:text-left lg:min-w-[140px]">
            <p
              className="text-5xl sm:text-6xl font-medium text-white tabular-nums"
              style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}
            >
              {stats.avg ? stats.avg.toFixed(1) : '—'}
            </p>
            <div className="flex justify-center lg:justify-start mt-2">
              <Stars value={stats.avg} size="md" />
            </div>
            <p className="text-sm text-[#C8BFAF] mt-2">
              {stats.count} {stats.count === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          {/* Histogram */}
          <div className="flex-1 space-y-2 min-w-0">
            {[5, 4, 3, 2, 1].map((star) => {
              const c = stats.buckets[star] || 0;
              const pct = stats.count ? Math.round((c / stats.count) * 100) : 0;
              const active = filterStar === star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFilterStar(active ? 0 : star)}
                  className={`w-full flex items-center gap-2 sm:gap-3 group text-left ${
                    active ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                  }`}
                  aria-pressed={active}
                >
                  <span className="text-xs text-[#C8BFAF] w-6 tabular-nums">{star}★</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        active ? 'bg-[#D4AF37]' : 'bg-[#3D5A80] group-hover:bg-[#D4AF37]/80'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#C8BFAF] w-10 text-right tabular-nums">{c}</span>
                </button>
              );
            })}
            {filterStar > 0 && (
              <button
                type="button"
                onClick={() => setFilterStar(0)}
                className="text-xs text-[#D4AF37] mt-1 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 lg:min-w-[180px]">
            <button
              type="button"
              onClick={handleWriteClick}
              className="min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-full bg-white text-[#0D0D0D] text-sm font-medium tracking-wide hover:bg-[#F7F4EE] transition-colors"
            >
              <MessageSquarePlus className="w-4 h-4" />
              {showForm ? 'Cancel' : 'Write a review'}
            </button>
            {!isAuthenticated && (
              <p className="text-[11px] text-[#C8BFAF] text-center lg:text-left">
                Login required to review
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Customer photos strip */}
      {photoReviews.length > 0 && (
        <div>
          <h3 className="text-sm uppercase tracking-[0.18em] text-[#3D5A80] mb-3">
            Customer photos
          </h3>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {photoReviews.flatMap((r) =>
              (r.images || []).slice(0, 3).map((url, i) => (
                <button
                  key={`${r.id}-${i}`}
                  type="button"
                  onClick={() => setLightbox(url)}
                  className="relative flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/[0.08] hover:border-[#D4AF37]/40 transition-colors"
                >
                  <Image src={url} alt="" fill className="object-cover" sizes="96px" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showForm && (
        <ReviewForm
          productId={productId}
          onSuccess={handleSuccess}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white">
          {sorted.length} {sorted.length === 1 ? 'review' : 'reviews'}
          {filterStar > 0 ? ` · ${filterStar}★` : ''}
        </p>
        <label className="flex items-center gap-2 text-sm text-[#C8BFAF]">
          <span className="sr-only">Sort reviews</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none bg-[#161616] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm text-[#F5F0E8] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50 min-h-[40px]"
          >
            <option value="newest">Newest</option>
            <option value="highest">Highest rated</option>
            <option value="helpful">Most helpful</option>
          </select>
          <ChevronDown className="w-4 h-4 -ml-7 pointer-events-none text-[#C8BFAF]" />
        </label>
      </div>

      {/* Review list */}
      <div className="space-y-4">
        {sorted.length === 0 && (
          <div className="panel-matte rounded-2xl p-8 text-center border border-white/[0.06]">
            <ImageIcon className="w-10 h-10 text-[#3D5A80] mx-auto mb-3" />
            <p className="text-white mb-1">No reviews yet</p>
            <p className="text-sm text-[#C8BFAF] mb-4">
              Be the first to share how this piece looks and feels.
            </p>
            <button
              type="button"
              onClick={handleWriteClick}
              className="inline-flex min-h-[44px] items-center px-5 rounded-full border border-[#D4AF37]/50 text-[#D4AF37] text-sm hover:bg-[#D4AF37]/10 transition-colors"
            >
              Write a review
            </button>
          </div>
        )}

        {sorted.map((r) => (
          <article
            key={r.id || `${r.user_id}-${r.created_at}`}
            className="panel-matte rounded-2xl p-4 sm:p-5 border border-white/[0.05]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{displayName(r)}</p>
                  {r.is_verified_purchase && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1E3A5F]/40 border border-[#3D5A80]/40 text-[#A8B4C8]">
                      <BadgeCheck className="w-3 h-3 text-[#D4AF37]" />
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Stars value={r.rating} />
                  <span className="text-xs text-[#C8BFAF]">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : ''}
                  </span>
                </div>
              </div>
            </div>

            {r.title && (
              <h4 className="mt-3 text-white text-sm sm:text-base font-medium">{r.title}</h4>
            )}
            {(r.comment || r.review_text) && (
              <p className="mt-2 text-sm text-[#F5F0E8]/85 leading-relaxed whitespace-pre-wrap">
                {r.comment || r.review_text}
              </p>
            )}

            {(r.images || []).length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-hide">
                {r.images.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightbox(url)}
                    className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden border border-white/[0.08]"
                  >
                    <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => markHelpful(r.id)}
                disabled={!r.id || helpfulBusy[r.id]}
                className="inline-flex items-center gap-1.5 text-xs text-[#C8BFAF] hover:text-[#D4AF37] transition-colors min-h-[36px] disabled:opacity-50"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Helpful
                {typeof r.helpful_count === 'number' && r.helpful_count > 0 && (
                  <span className="tabular-nums">({r.helpful_count})</span>
                )}
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Review photo"
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white text-sm"
            onClick={() => setLightbox(null)}
          >
            Close
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Customer review"
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
