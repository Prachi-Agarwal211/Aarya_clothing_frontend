/**
 * Hook for tracking cart reservation expiry countdown
 * Shows warning when reservations are about to expire
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

export function useReservationCountdown(expiresAt) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const calculateTimeRemaining = useCallback(() => {
    if (!expiresAt) return null;
    
    const expiry = new Date(expiresAt).getTime();
    const now = Date.now();
    const diff = expiry - now;
    
    if (diff <= 0) {
      setIsExpired(true);
      return null;
    }
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return { minutes, seconds, totalMs: diff };
  }, [expiresAt]);

  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining(null);
      setIsExpiringSoon(false);
      setIsExpired(false);
      return;
    }

    // Initial calculation
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setTimeRemaining(remaining);
      
      if (remaining) {
        // Warning when less than 3 minutes remaining
        setIsExpiringSoon(remaining.totalMs < 3 * 60 * 1000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, calculateTimeRemaining]);

  const formatTime = useCallback(() => {
    if (!timeRemaining) return '';
    const { minutes, seconds } = timeRemaining;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeRemaining]);

  return {
    timeRemaining,
    formattedTime: formatTime(),
    isExpiringSoon,
    isExpired,
    progress: timeRemaining ? (timeRemaining.totalMs / (15 * 60 * 1000)) * 100 : 0
  };
}
