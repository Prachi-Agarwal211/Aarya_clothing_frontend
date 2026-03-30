'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useIntroVideo } from '@/lib/siteConfigContext';
import { useViewport } from '@/lib/hooks/useViewport';
import logger from '@/lib/logger';

export default function IntroVideo({ onVideoEnd }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const preloaderTimerRef = useRef(null);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);

  const { isMobile } = useViewport();
  const introVideo = useIntroVideo();

  // CRITICAL: Video URL selection with fallback chain
  // Mobile → mobile || desktop
  // Desktop → desktop || mobile
  // MUST NEVER be null/empty - always have a video to play
  const videoUrl = isMobile
    ? (introVideo.mobile || introVideo.desktop)
    : (introVideo.desktop || introVideo.mobile);

  // Connection quality detection — skip on data-saver or very slow connections
  const shouldSkipForNetwork = () => {
    if (typeof navigator === 'undefined') return false;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return false;
    if (conn.saveData) return true;
    if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') return true;
    return false;
  };

  // Reduced motion preference
  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Check session — skip if already seen, admin disabled, slow network, or reduced motion
  useEffect(() => {
    const hasSeenIntro = sessionStorage.getItem('hasSeenIntroVideo');
    if (hasSeenIntro || introVideo.enabled === false || shouldSkipForNetwork() || prefersReducedMotion()) {
      setIsVideoEnded(true);
      onVideoEnd?.();
    }
  }, [onVideoEnd, introVideo.enabled]);

  // Adaptive preloader: full 1400ms normally, cut to 600ms if video already buffered
  const startVideo = () => {
    setShowPreloader(false);
    setVideoStarted(true);
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play()
        .then(() => setAutoplayFailed(false))
        .catch((err) => {
          logger.warn('Autoplay failed:', err);
          setAutoplayFailed(true);
        });
    }
  };

  useEffect(() => {
    if (isVideoEnded) return;
    preloaderTimerRef.current = setTimeout(startVideo, 1400);
    return () => clearTimeout(preloaderTimerRef.current);
  }, [isVideoEnded]);

  // Show skip button 2s after video starts
  useEffect(() => {
    if (!videoStarted) return;
    const skipTimer = setTimeout(() => setShowSkip(true), 2000);
    return () => clearTimeout(skipTimer);
  }, [videoStarted]);

  // Smooth volume fade-in on unmute
  const fadeInVolume = (video) => {
    video.volume = 0;
    video.muted = false;
    let vol = 0;
    const step = () => {
      vol = Math.min(1, vol + 0.08);
      video.volume = vol;
      if (vol < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const handlePlayWithSound = () => {
    if (!videoRef.current) return;
    fadeInVolume(videoRef.current);
    setIsMuted(false);
    if (autoplayFailed) {
      videoRef.current.play()
        .then(() => setAutoplayFailed(false))
        .catch(() => {});
    }
  };

  const handleVideoEnd = () => {
    setIsFadingOut(true);
    sessionStorage.setItem('hasSeenIntroVideo', 'true');
    setTimeout(() => {
      setIsVideoEnded(true);
      onVideoEnd?.();
    }, 600);
  };

  const handleSkip = () => {
    if (videoRef.current) videoRef.current.pause();
    handleVideoEnd();
  };

  const handleVideoError = () => {
    setVideoError(true);
    setTimeout(() => handleVideoEnd(), 400);
  };

  // When video is ready to play: cut preloader short if it hasn't fired yet
  const handleVideoCanPlay = () => {
    setVideoLoaded(true);
    if (preloaderTimerRef.current && showPreloader) {
      clearTimeout(preloaderTimerRef.current);
      preloaderTimerRef.current = setTimeout(startVideo, 300);
    }
  };

  // Track buffer progress for loading indicator
  const handleProgress = () => {
    const video = videoRef.current;
    if (!video || !video.duration || video.buffered.length === 0) return;
    const buffered = video.buffered.end(video.buffered.length - 1);
    setBufferProgress(Math.round((buffered / video.duration) * 100));
  };

  if (isVideoEnded) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] transition-opacity duration-600 ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ background: '#050203' }}
    >
      {/* ── Branded Preloader ── */}
      <div
        className={`absolute inset-0 z-30 flex flex-col items-center justify-center transition-opacity duration-700 ${showPreloader ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'linear-gradient(135deg, #0a0608 0%, #1a0a12 50%, #0a0608 100%)' }}
      >
        {/* Ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#B76E79]/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-[#F2C29A]/5 rounded-full blur-[60px]" />

        {/* Logo reveal */}
        <div className="relative flex flex-col items-center gap-6">
          {/* Spinning ring */}
          <div className="relative w-28 h-28 sm:w-36 sm:h-36">
            <div className="absolute inset-0 rounded-full border border-[#F2C29A]/10" />
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#F2C29A]/60 border-r-[#B76E79]/30 animate-spin"
              style={{ animationDuration: '2s' }}
            />
            <div
              className="absolute inset-3 rounded-full border border-[#B76E79]/20 border-b-[#F2C29A]/40 animate-spin"
              style={{ animationDuration: '3s', animationDirection: 'reverse' }}
            />
            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-[#F2C29A]/40 animate-pulse" />
            </div>
          </div>

          {/* Brand name */}
          <div className="text-center space-y-1">
            <p
              className="text-[#F2C29A] text-xl sm:text-2xl tracking-[0.4em] uppercase"
              style={{ fontFamily: 'var(--font-cinzel), serif' }}
            >
              Aarya
            </p>
            <p className="text-[#EAE0D5]/40 text-xs tracking-[0.3em] uppercase">
              Clothing
            </p>
          </div>
        </div>

        {/* Buffer progress bar + loading dots */}
        <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-3 px-12">
          <div className="w-full max-w-[200px] h-[1px] bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#B76E79]/60 to-[#F2C29A]/60 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(5, bufferProgress)}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[#B76E79]/50 animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Video Layer ── */}
      <div className="absolute inset-0 overflow-hidden">
        {!videoError && videoUrl ? (
          <video
            ref={videoRef}
            key={videoUrl}
            muted
            playsInline
            preload="metadata"
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            onCanPlay={handleVideoCanPlay}
            onProgress={handleProgress}
            className="absolute inset-0 w-full h-full object-cover"
            src={videoUrl}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0a0608 0%, #1a0a12 50%, #0a0608 100%)' }}
          >
            <p className="text-[#EAE0D5]/30 text-sm tracking-[0.3em] uppercase">
              Loading Experience
            </p>
          </div>
        )}

        {/* Cinematic gradient overlays */}
        {!videoError && (
          <>
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black/20 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black/20 to-transparent z-10 pointer-events-none" />
          </>
        )}
      </div>

      {/* ── Controls (visible after preloader gone) ── */}
      <div className={`absolute inset-0 z-20 transition-opacity duration-700 ${showPreloader ? 'opacity-0' : 'opacity-100'}`}>

        {/* Centered play button — shown when muted or autoplay failed */}
        {(isMuted || autoplayFailed) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={handlePlayWithSound}
              className="pointer-events-auto w-16 h-16 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/70 hover:scale-110 transition-all duration-300 active:scale-95 shadow-2xl"
              aria-label="Play video"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}

        {/* Skip button — bottom right */}
        {showSkip && (
          <button
            onClick={handleSkip}
            className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 pointer-events-auto px-5 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-medium rounded-full hover:bg-white/20 transition-all duration-300 active:scale-95 hover:border-[#F2C29A]/50"
            style={{ fontFamily: 'var(--font-cinzel), serif' }}
          >
            Skip Intro
          </button>
        )}
      </div>
    </div>
  );
}
