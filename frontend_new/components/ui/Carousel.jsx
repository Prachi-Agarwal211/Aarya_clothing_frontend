'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { gsap, Draggable } from '@/lib/gsapConfig';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Carousel - Enhanced carousel component with hero support
 * 
 * Features:
 * - GSAP Draggable for touch/swipe
 * - Auto-play with pause on hover
 * - Hero mode with crossfade transitions
 * - Image-only mode (no text overlays)
 * - Glass-morphism styling option
 * - Navigation dots and arrows
 */
const Carousel = ({ 
  children, 
  className,
  // Hero mode props
  heroMode = false,
  slides = [],
  autoPlay = true,
  interval = 5000,
  showDots = true,
  showArrows = true,
  aspectRatio = '21/9',
  glassEffect = false,
  imageOnly = false
}) => {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const slideRefs = useRef([]);
  const autoPlayRef = useRef(null);

  // Hero mode: Auto-play
  const nextSlide = useCallback(() => {
    if (isTransitioning || !slides.length) return;
    const next = (currentSlide + 1) % slides.length;
    goToSlide(next);
  }, [currentSlide, slides.length, isTransitioning]);

  // Hero mode: Go to specific slide
  const goToSlide = useCallback((index) => {
    if (isTransitioning || index === currentSlide || !slideRefs.current[index]) return;
    
    setIsTransitioning(true);
    
    const outgoingSlide = slideRefs.current[currentSlide];
    const incomingSlide = slideRefs.current[index];
    
    const tl = gsap.timeline({
      onComplete: () => setIsTransitioning(false)
    });
    
    tl.to(outgoingSlide, {
      opacity: 0,
      scale: 1.05,
      duration: 0.6,
      ease: 'power2.inOut'
    })
    .set(outgoingSlide, { zIndex: 0 })
    .set(incomingSlide, { zIndex: 1, opacity: 0, scale: 1.1 })
    .to(incomingSlide, {
      opacity: 1,
      scale: 1,
      duration: 0.8,
      ease: 'power2.out'
    });
    
    setCurrentSlide(index);
  }, [currentSlide, isTransitioning]);

  const prevSlide = useCallback(() => {
    const prev = (currentSlide - 1 + slides.length) % slides.length;
    goToSlide(prev);
  }, [currentSlide, slides.length, goToSlide]);

  // Auto-play effect
  useEffect(() => {
    if (heroMode && autoPlay && !isHovered && slides.length > 1) {
      autoPlayRef.current = setInterval(nextSlide, interval);
    }
    
    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [heroMode, autoPlay, isHovered, interval, nextSlide, slides.length]);

  // Initial animation for hero mode
  useEffect(() => {
    if (heroMode && slideRefs.current[0]) {
      gsap.fromTo(slideRefs.current[0],
        { opacity: 0, scale: 1.1 },
        { opacity: 1, scale: 1, duration: 1, ease: 'power2.out', delay: 0.5 }
      );
    }
  }, [heroMode]);

  // Standard carousel: Draggable setup
  useEffect(() => {
    if (heroMode || typeof window === 'undefined' || !trackRef.current) return;

    const updateBounds = () => {
        if (!containerRef.current || !trackRef.current) return;
        
        const containerWidth = containerRef.current.offsetWidth;
        const trackWidth = trackRef.current.scrollWidth;
        const minX = containerWidth - trackWidth;
        
        if (minX > 0) return { minX: 0, maxX: 0 };
        
        return { minX, maxX: 0 };
    };

    const draggable = Draggable.create(trackRef.current, {
      type: "x",
      edgeResistance: 0.65,
      bounds: containerRef.current,
      inertia: true,
      zIndexBoost: false,
      cursor: "grab",
      activeCursor: "grabbing"
    })[0];

    const handleResize = () => {
      draggable.applyBounds(containerRef.current);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      draggable.kill();
      window.removeEventListener('resize', handleResize);
    };
  }, [children, heroMode]);

  // Standard carousel: Scroll function
  const scroll = (direction) => {
    if (!trackRef.current || !containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const currentX = gsap.getProperty(trackRef.current, "x");
    const scrollAmount = containerWidth * 0.8;
    const targetX = direction === 'left' 
      ? Math.min(0, currentX + scrollAmount)
      : Math.max(containerRef.current.offsetWidth - trackRef.current.scrollWidth, currentX - scrollAmount);

    gsap.to(trackRef.current, {
      x: targetX,
      duration: 0.5,
      ease: "power2.out"
    });
  };

  // Hero mode rendering
  if (heroMode) {
    return (
      <div 
        className={cn("relative group", className)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Carousel Container */}
        <div 
          ref={containerRef}
          className={cn(
            "relative overflow-hidden rounded-3xl",
            glassEffect && "bg-[#0B0608]/40 backdrop-blur-md border border-[#B76E79]/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]"
          )}
          style={{ aspectRatio }}
        >
          {/* Slides */}
          {slides.map((slide, index) => (
            <div
              key={index}
              ref={el => slideRefs.current[index] = el}
              className={cn(
                "absolute inset-0",
                index === 0 ? 'z-[1]' : 'z-0 opacity-0'
              )}
            >
              {/* Background Image - Full slide */}
              {slide.image && (
                <div className="absolute inset-0">
                  <Image
                    src={slide.image}
                    alt={`Slide ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                  />
                  {/* Subtle gradient overlay for better visual */}
                  {!imageOnly && (
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0608]/60 via-transparent to-transparent" />
                  )}
                </div>
              )}
              
              {/* Content - Only show if NOT imageOnly mode */}
              {!imageOnly && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                  {slide.tagline && (
                    <span 
                      className="text-[#B76E79] text-xs sm:text-sm tracking-[0.3em] uppercase mb-4"
                      style={{ fontFamily: 'Cinzel, serif' }}
                    >
                      {slide.tagline}
                    </span>
                  )}
                  
                  {slide.title && (
                    <h2 
                      className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl text-[#EAE0D5] mb-4 max-w-2xl"
                      style={{ fontFamily: 'Playfair Display, serif' }}
                    >
                      {slide.title}
                    </h2>
                  )}
                  
                  {slide.subtitle && (
                    <p className="text-[#EAE0D5]/70 text-sm sm:text-base md:text-lg max-w-xl font-light">
                      {slide.subtitle}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {/* Navigation Arrows */}
          {showArrows && slides.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="
                  absolute left-4 top-1/2 -translate-y-1/2 z-20
                  p-2 sm:p-3
                  bg-[#0B0608]/60 backdrop-blur-sm
                  border border-[#B76E79]/30
                  text-[#EAE0D5] rounded-full
                  opacity-0 group-hover:opacity-100
                  transition-all duration-300
                  hover:bg-[#B76E79]/30 hover:border-[#F2C29A]/50
                "
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              
              <button
                onClick={nextSlide}
                className="
                  absolute right-4 top-1/2 -translate-y-1/2 z-20
                  p-2 sm:p-3
                  bg-[#0B0608]/60 backdrop-blur-sm
                  border border-[#B76E79]/30
                  text-[#EAE0D5] rounded-full
                  opacity-0 group-hover:opacity-100
                  transition-all duration-300
                  hover:bg-[#B76E79]/30 hover:border-[#F2C29A]/50
                "
                aria-label="Next slide"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </>
          )}
        </div>
        
        {/* Navigation Dots */}
        {showDots && slides.length > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "transition-all duration-300 rounded-full",
                  index === currentSlide 
                    ? 'w-8 h-2 bg-[#F2C29A]' 
                    : 'w-2 h-2 bg-[#B76E79]/40 hover:bg-[#B76E79]/60'
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Standard carousel rendering
  return (
    <div className={cn("relative group", className)}>
      {/* Navigation Buttons */}
      {showArrows && (
        <>
          <button 
            onClick={() => scroll('left')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-[#0B0608]/80 border border-[#F2C29A]/30 text-[#EAE0D5] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-[#F2C29A] hover:text-[#050203] disabled:opacity-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => scroll('right')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 bg-[#0B0608]/80 border border-[#F2C29A]/30 text-[#EAE0D5] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-[#F2C29A] hover:text-[#050203]"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {/* Carousel Track */}
      <div ref={containerRef} className="overflow-hidden w-full px-4 md:px-8 py-8">
        <div ref={trackRef} className="flex gap-6 w-max touch-pan-x">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Carousel;
