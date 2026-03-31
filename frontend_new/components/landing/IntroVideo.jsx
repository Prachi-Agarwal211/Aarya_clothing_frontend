'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useIntroVideo } from '@/lib/siteConfigContext';
import { useViewport } from '@/lib/hooks/useViewport';
import logger from '@/lib/logger';

// ── Network quality helpers ──────────────────────────────────────────────────
function getNetworkQuality() {
  if (typeof navigator === 'undefined') return 'unknown';
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return 'unknown';
  if (conn.saveData) return 'save-data';
  const et = conn.effectiveType;
  if (et === '2g' || et === 'slow-2g') return 'slow';
  if (et === '3g') return 'medium';
  return 'fast';
}
function shouldSkipForNetwork() {
  const q = getNetworkQuality();
  return q === 'save-data' || q === 'slow';
}
function getPreloaderDuration() {
  const q = getNetworkQuality();
  if (q === 'save-data') return 0;
  if (q === 'slow') return 800;
  if (q === 'medium') return 1100;
  return 1400;
}

// ── localStorage with 24h TTL ────────────────────────────────────────────────
function hasSeenIntroRecently() {
  try {
    const ts = localStorage.getItem('introVideoLastSeen');
    if (!ts) return false;
    const parsed = parseInt(ts, 10);
    if (isNaN(parsed)) return false;
    return Date.now() - parsed < 24 * 60 * 60 * 1000;
  } catch (e) {
    logger.warn('Failed to check intro video status:', e);
    return false;
  }
}
function markIntroSeen() {
  try {
    const now = Date.now().toString();
    localStorage.setItem('introVideoLastSeen', now);
    sessionStorage.setItem('hasSeenIntroVideo', 'true');
    logger.log('Intro video marked as seen:', new Date(parseInt(now, 10)).toISOString());
  } catch (e) {
    logger.warn('Failed to mark intro as seen:', e);
  }
}

export default function IntroVideo({ onVideoEnd }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const preloaderTimerRef = useRef(null);
  const retryCountRef = useRef(0);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [autoplayFailed, setAutoplayFailed] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);

  const { isMobile } = useViewport();
  const introVideo = useIntroVideo();

  const videoUrl = isMobile
    ? (introVideo.mobile || introVideo.desktop)
    : (introVideo.desktop || introVideo.mobile);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Skip if already seen recently, disabled, slow network, or reduced motion
  // NOTE: Removed isMobile skip - users want to see the video on mobile too!
  useEffect(() => {
    const seenRecently = hasSeenIntroRecently();
    const seenInSession = !!sessionStorage.getItem('hasSeenIntroVideo');
    const skip =
      seenRecently ||
      seenInSession ||
      introVideo.enabled === false ||
      shouldSkipForNetwork() ||
      prefersReducedMotion;

    logger.log('IntroVideo skip check:', {
      isMobile,
      seenRecently,
      seenInSession,
      enabled: introVideo.enabled,
      slowNetwork: shouldSkipForNetwork(),
      reducedMotion: prefersReducedMotion,
      willSkip: skip
    });

    if (skip) {
      logger.log('Skipping intro video');
      setIsVideoEnded(true);
      onVideoEnd?.();
    }
  }, [onVideoEnd, introVideo.enabled, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const startVideo = useCallback(() => {
    setShowPreloader(false);
    setVideoStarted(true);
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.play()
        .then(() => {
          logger.log('Video started playing successfully');
          setAutoplayFailed(false);
        })
        .catch((err) => {
          logger.warn('Video autoplay failed:', err.message, err.name);
          setAutoplayFailed(true);
        });
    }
  }, []);

  useEffect(() => {
    if (isVideoEnded) return;
    preloaderTimerRef.current = setTimeout(startVideo, getPreloaderDuration());
    return () => clearTimeout(preloaderTimerRef.current);
  }, [isVideoEnded, startVideo]);

  useEffect(() => {
    if (!videoStarted) return;
    const t = setTimeout(() => setShowSkip(true), 2000);
    return () => clearTimeout(t);
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

  const handleVideoEnd = useCallback(() => {
    setIsFadingOut(true);
    markIntroSeen();
    setTimeout(() => {
      setIsVideoEnded(true);
      onVideoEnd?.();
    }, 600);
  }, [onVideoEnd]);

  const handleSkip = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
    handleVideoEnd();
  }, [handleVideoEnd]);

  // One retry on MEDIA_ERR_NETWORK; skip gracefully for other errors
  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const err = video?.error;
    const errorCode = err?.code;
    const errorMessage = err?.message || 'Unknown error';
    
    logger.error('IntroVideo error:', {
      code: errorCode,
      message: errorMessage,
      network: typeof navigator !== 'undefined'
        ? (navigator.connection?.effectiveType || 'unknown') : 'ssr',
      currentTime: video?.currentTime,
      duration: video?.duration,
    });
    
    // Error codes: 1=MEDIA_ERR_ABORTED, 2=MEDIA_ERR_NETWORK, 3=MEDIA_ERR_DECODE, 4=MEDIA_ERR_SRC_NOT_SUPPORTED
    if (errorCode === 2 && retryCountRef.current < 2) {
      // Network error - retry up to 2 times
      retryCountRef.current += 1;
      logger.warn(`Retrying video load (attempt ${retryCountRef.current}/2)`);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch((playErr) => {
            logger.error('Retry play failed:', playErr.message);
            // Don't set videoError yet - let it continue playing if possible
          });
        }
      }, 1500);
      return;
    }
    
    // For other errors, log but don't end the video - it might still play
    if (errorCode === 1) {
      logger.warn('Video was aborted (user likely navigated away)');
      return; // Don't end, just log
    }
    
    // Only set videoError for critical errors (3=decode, 4=src not supported)
    if (errorCode === 3 || errorCode === 4) {
      logger.error('Critical video error, ending intro');
      setVideoError(true);
      setTimeout(handleVideoEnd, 800);
    }
  }, [handleVideoEnd]);

  const handleVideoCanPlay = useCallback(() => {
    logger.log('Video can play - clearing preloader');
    if (preloaderTimerRef.current && showPreloader) {
      clearTimeout(preloaderTimerRef.current);
      preloaderTimerRef.current = null;
      setShowPreloader(false);
      setVideoStarted(true);
    }
  }, [showPreloader]);

  // Keyboard: Escape = skip — placed after handleSkip to avoid TDZ
  useEffect(() => {
    if (isVideoEnded) return;
    const onKey = (e) => { if (e.key === 'Escape') handleSkip(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isVideoEnded, handleSkip]);

  // Track buffer progress for loading indicator
  const handleProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration || video.buffered.length === 0) return;
    const buffered = video.buffered.end(video.buffered.length - 1);
    const progress = Math.round((buffered / video.duration) * 100);
    setBufferProgress(progress);
    
    // Log when video is mostly buffered
    if (progress > 80 && progress < 85) {
      logger.log(`Video buffered: ${progress}%`);
    }
  }, []);

  if (isVideoEnded) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] transition-opacity duration-600 ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ background: '#050203' }}
      role="dialog"
      aria-label="Intro video. Press Escape to skip."
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
            onWaiting={() => logger.log('Video waiting (buffering)')}
            onPlaying={() => logger.log('Video started playing')}
            onPause={() => logger.log('Video paused')}
            className="absolute inset-0 w-full h-full object-cover"
            src={videoUrl}
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%230a0608' width='100' height='100'/%3E%3C/svg%3E"
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

        {/* Centered play button — ONLY when autoplay failed and video is not playing */}
        {autoplayFailed && !videoStarted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <button
              onClick={handlePlayWithSound}
              className="pointer-events-auto w-16 h-16 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-black/70 hover:scale-110 transition-all duration-300 active:scale-95 shadow-2xl"
              aria-label="Play video with sound"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}

        {/* Small unmute button — shown when video is playing muted */}
        {videoStarted && isMuted && (
          <button
            onClick={handlePlayWithSound}
            className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8 pointer-events-auto flex items-center gap-2 px-3 py-2 bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs rounded-full hover:bg-black/60 transition-all duration-300 active:scale-95"
            aria-label="Unmute video"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
            <span>Tap for sound</span>
          </button>
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
