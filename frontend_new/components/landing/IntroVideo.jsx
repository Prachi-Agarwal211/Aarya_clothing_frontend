'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useIntroVideo } from '@/lib/siteConfigContext';
import { useIntroVideoOverlay } from '@/lib/introVideoOverlayContext';
import { useViewport } from '@/lib/hooks/useViewport';
import logger from '@/lib/logger';

// ── Network quality helpers ──────────────────────────────────────────────────
// ── localStorage helpers ──────────────────────────────────────────────────────
function hasSeenIntro() {
  try {
    return localStorage.getItem('introVideoSeen') === 'true';
  } catch (e) {
    logger.warn('Failed to check intro video status:', e);
    return false;
  }
}
function markIntroSeen() {
  try {
    localStorage.setItem('introVideoSeen', 'true');
    logger.log('Intro video marked as seen');
  } catch (e) {
    logger.warn('Failed to mark intro as seen:', e);
  }
}

/**
 * Intro: Auto-play on load (muted for browser compatibility).
 * - Browsers allow muted autoplay without user gesture
 * - Video starts loading immediately with preload="auto"
 * - Plays muted, can be unmuted by user via controls or we add our own unmute button
 */
export default function IntroVideo({ onVideoEnd }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [hasStartedPlayback, setHasStartedPlayback] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  const { isMobile } = useViewport();
  const introVideo = useIntroVideo();
  const { setIntroOverlayActive } = useIntroVideoOverlay();

  useEffect(() => {
    setIntroOverlayActive(true);
    return () => setIntroOverlayActive(false);
  }, [setIntroOverlayActive]);

  const videoUrl = isMobile
    ? (introVideo.mobile || introVideo.desktop)
    : (introVideo.desktop || introVideo.mobile);

  if (!videoUrl) {
    logger.error('Intro video URL is missing!', {
      introVideo,
      isMobile,
      videoConfig: JSON.stringify(introVideo),
    });
  }

  useEffect(() => {
    const seenBefore = hasSeenIntro();
    const skip =
      // Product requirement: mobile should not show intro video.
      isMobile ||
      seenBefore ||
      introVideo.enabled === false ||
      !videoUrl;

    logger.log('IntroVideo skip check:', {
      isMobile,
      seenBefore,
      enabled: introVideo.enabled,
      hasVideoUrl: Boolean(videoUrl),
      willSkip: skip,
    });

    if (skip) {
      logger.log('Skipping intro video');
      setIsVideoEnded(true);
      onVideoEnd?.();
    }
  }, [onVideoEnd, introVideo.enabled, isMobile, videoUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVideoEnd = useCallback(() => {
    setIsFadingOut(true);
    markIntroSeen();
    setTimeout(() => {
      setIsVideoEnded(true);
      onVideoEnd?.();
    }, 600);
  }, [onVideoEnd]);

  const handleSkip = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.muted = true;
    }
    handleVideoEnd();
  }, [handleVideoEnd]);

  const handleVideoError = useCallback(() => {
    const video = videoRef.current;
    const err = video?.error;
    const errorCode = err?.code;
    const errorMessage = err?.message || 'Unknown error';

    logger.error('IntroVideo error:', {
      code: errorCode,
      message: errorMessage,
      network:
        typeof navigator !== 'undefined'
          ? navigator.connection?.effectiveType || 'unknown'
          : 'ssr',
      currentTime: video?.currentTime,
      duration: video?.duration,
    });

    if (errorCode === 1) {
      logger.warn('Video was aborted (user likely navigated away)');
      return;
    }

    // Critical errors - end the intro
    if (errorCode === 3 || errorCode === 4) {
      logger.error('Critical video error, ending intro');
      setVideoError(true);
      setTimeout(handleVideoEnd, 800);
    }
  }, [handleVideoEnd]);

  const handlePlayWithAudio = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      video.muted = false;
      await video.play();
      setHasStartedPlayback(true);
      setPlaybackFailed(false);
    } catch (error) {
      logger.error('Play with audio failed, falling back to muted playback', error);
      try {
        video.muted = true;
        await video.play();
        setHasStartedPlayback(true);
      } catch (fallbackError) {
        logger.error('Muted fallback playback failed', fallbackError);
        setPlaybackFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isVideoEnded) return;
    const onKey = (e) => {
      if (e.key === 'Escape') handleSkip();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isVideoEnded, handleSkip]);

  if (isVideoEnded) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[200] transition-opacity duration-600 ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ background: '#050203' }}
      role="dialog"
      aria-label="Intro video. Press Escape to skip."
    >
      {/* Video layer */}
      <div className="absolute inset-0 overflow-hidden">
        {!videoError && videoUrl ? (
          <video
            ref={videoRef}
            key={videoUrl}
            playsInline
            preload="auto"
            muted
            onEnded={handleVideoEnd}
            onError={handleVideoError}
            onPlaying={() => {
              logger.log('Intro video playing');
            }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${hasStartedPlayback ? 'opacity-100' : 'opacity-100'}`}
            src={videoUrl}
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23050203' width='100' height='100'/%3E%3C/svg%3E"
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: '#050203' }}
          >
            <p className="text-[#EAE0D5]/40 text-xs tracking-[0.2em] uppercase">Intro unavailable</p>
          </div>
        )}

        {!videoError && hasStartedPlayback && (
          <>
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent z-10 pointer-events-none" />
          </>
        )}
      </div>

      {/* Skip — bottom left (not right) — Always visible */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <button
          type="button"
          onClick={handleSkip}
          className="pointer-events-auto absolute bottom-8 left-8 sm:bottom-10 sm:left-10 px-5 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-medium rounded-full hover:bg-white/20 transition-all duration-300 active:scale-95 hover:border-[#F2C29A]/50"
          style={{ fontFamily: 'var(--font-cinzel), serif' }}
        >
          Skip intro
        </button>
      </div>

      {/* Play overlay: user explicitly starts intro with audio */}
      {!hasStartedPlayback && !videoError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 pointer-events-none px-6">
          <button
            type="button"
            onClick={handlePlayWithAudio}
            className="pointer-events-auto flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-2xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
            aria-label="Play intro video with audio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 sm:h-12 sm:w-12" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <p className="pointer-events-none text-center text-sm text-[#EAE0D5]/70">Play intro with audio</p>
          {playbackFailed && (
            <p className="pointer-events-none text-center text-xs text-red-300/90">
              Playback failed. Please tap again or use Skip intro.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
