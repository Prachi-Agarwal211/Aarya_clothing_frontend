'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useIntroVideo } from '@/lib/siteConfigContext';
import { useViewport } from '@/lib/hooks/useViewport';

export default function IntroVideo({ onVideoEnd }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [showEnterPrompt, setShowEnterPrompt] = useState(true);
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Shared viewport hook (DRY — reused by HeroSection too)
  const { isMobile, isDesktop } = useViewport();

  // Get video URLs from backend via context
  // Returns { desktop: '16:9 url', mobile: '9:16 url' }
  const introVideo = useIntroVideo();

  // Select the correct video source for the device
  // Mobile gets 9:16, Desktop gets 16:9. Falls back gracefully.
  const videoUrl = isMobile
    ? (introVideo.mobile || introVideo.desktop)
    : (introVideo.desktop || introVideo.mobile);

  // Removed debug log for production

  // Determine video aspect ratio based on device
  const videoAspectRatio = isMobile ? '9/16' : '16/9';

  // Check if user has already seen the intro video in this session
  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem('hasSeenIntroVideo');
    if (hasSeenIntro) {
      setIsVideoEnded(true);
      onVideoEnd?.();
      return;
    }
  }, [onVideoEnd]);

  // Show skip button after video starts playing (ALL devices)
  useEffect(() => {
    if (videoStarted) {
      const skipTimer = setTimeout(() => {
        setShowSkip(true);
      }, 1500);
      return () => clearTimeout(skipTimer);
    }
  }, [videoStarted]);

  const handleVideoEnd = () => {
    setIsFadingOut(true);

    // Mark as seen in session storage
    sessionStorage.setItem('hasSeenIntroVideo', 'true');

    // Wait for fade out animation then complete
    setTimeout(() => {
      setIsVideoEnded(true);
      onVideoEnd?.();
    }, 500);
  };

  const handleSkip = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    handleVideoEnd();
  };

  const handleEnter = () => {
    setShowEnterPrompt(false);
    setVideoStarted(true);
    // Video will auto-play with audio since user has interacted
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
      videoRef.current.play().catch(err => {
        // If autoplay with audio fails, try muted
        console.log('Autoplay with audio failed, falling back to muted:', err);
        videoRef.current.muted = true;
        videoRef.current.play();
      });
    }
  };

  const handleVideoError = () => {
    console.error('Video failed to load');
    setVideoError(true);
    // Auto-skip to main content if video fails
    setTimeout(() => {
      handleVideoEnd();
    }, 500); // reduced from 3000 for fast-skip
  };

  // If video ended or already seen, don't render
  if (isVideoEnded) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #1a0a28 50%, #0a2818 100%)',
      }}
    >
      {/* Cinematic Ambient Effects */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Warm golden light from top-left */}
        <div
          className="absolute top-0 left-0 w-[60%] h-[60%] opacity-30"
          style={{
            background: 'radial-gradient(ellipse at 0% 0%, rgba(255, 200, 100, 0.4) 0%, transparent 70%)',
          }}
        />
        {/* Cool blue light from bottom-right */}
        <div
          className="absolute bottom-0 right-0 w-[50%] h-[50%] opacity-20"
          style={{
            background: 'radial-gradient(ellipse at 100% 100%, rgba(100, 150, 255, 0.3) 0%, transparent 70%)',
          }}
        />
        {/* Subtle film grain texture */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Video Container - Full Viewport */}
      <div
        className="relative w-full h-full flex items-center justify-center"
      >
        {/* Video or Fallback */}
        <div className="absolute inset-0 overflow-hidden">
          {!videoError && videoUrl ? (
            <video
              ref={videoRef}
              key={videoUrl} // Re-mount when URL changes (e.g. on orientation change)
              muted
              playsInline
              onEnded={handleVideoEnd}
              onError={handleVideoError}
              className="w-full h-full object-cover"
              src={videoUrl}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                objectFit: 'cover',
              }}
              {...(isMobile && {
                playsInline: true,
                webkitPlaysInline: true,
              })}
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            // Cinematic Fallback with Brand Aesthetic
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #0a1628 0%, #1a0a28 50%, #0a2818 100%)',
              }}
            >
              {/* Animated loading indicator */}
              <div className="relative mb-8">
                <div className="w-24 h-24 border-2 border-amber-500/20 rounded-full" />
                <div
                  className="absolute inset-0 w-24 h-24 border-2 border-transparent border-t-amber-400 rounded-full animate-spin"
                  style={{ animationDuration: '2s' }}
                />
              </div>
              <p className="text-amber-200/60 text-sm tracking-[0.3em] uppercase">
                Loading Experience
              </p>
            </div>
          )}

          {/* Gradient Overlays for Video */}
          {!videoError && (
            <>
              {/* Top gradient for header visibility */}
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent z-10" />
              {/* Bottom gradient for button area */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent z-10" />
            </>
          )}
        </div>

        {/* Enter Prompt - Click to start video with audio */}
        {showEnterPrompt && !videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-20">
            {/* Cinematic Enter Button */}
            <button
              onClick={handleEnter}
              className="group flex flex-col items-center gap-6 cursor-pointer"
            >
              {/* Animated ring effect */}
              <div className="relative">
                <div className="absolute inset-0 w-20 h-20 sm:w-28 sm:h-28 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-white/5 backdrop-blur-md flex items-center justify-center border border-white/20 transition-all duration-500 group-hover:bg-white/10 group-hover:scale-110 group-hover:border-amber-400/50">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="white"
                    viewBox="0 0 24 24"
                    className="w-6 h-6 sm:w-10 sm:h-10 ml-1"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              {/* Text with cinematic styling */}
              <span
                className="text-white/80 text-sm sm:text-lg tracking-[0.2em] sm:tracking-[0.3em] uppercase transition-all duration-300 group-hover:text-amber-200"
                style={{ fontFamily: 'var(--font-cinzel), serif' }}
              >
                Enter
              </span>
            </button>
          </div>
        )}

        {/* Skip Button - shown after video starts (ALL devices) */}
        {showSkip && !showEnterPrompt && (
          <button
            onClick={handleSkip}
            className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 px-5 py-2.5 sm:px-6 sm:py-3 bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm sm:text-base font-medium rounded-full hover:bg-white/20 transition-all duration-300 active:scale-95 sm:hover:scale-105 hover:border-amber-400/50 z-30"
            style={{
              fontFamily: 'var(--font-cinzel), serif',
            }}
          >
            Skip Intro
          </button>
        )}

        {/* Progress indicator during video playback */}
        {!showEnterPrompt && !videoError && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
            <div className="w-2 h-2 rounded-full bg-amber-400/60 animate-pulse" />
            <span className="text-white/40 text-xs tracking-widest uppercase">
              Playing
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
