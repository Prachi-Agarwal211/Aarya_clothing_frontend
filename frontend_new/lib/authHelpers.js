'use client';

import { useCallback } from 'react';

const OTP_EXPIRY_SECONDS = 120;
const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Custom hook for OTP timer management
 * @param {number} initialSeconds - Initial timer value (default: 120)
 * @param {function} onComplete - Callback when timer expires
 * @returns {Object} Timer state and controls
 */
export function useOtpTimer(initialSeconds = OTP_EXPIRY_SECONDS, onComplete) {
  const handleTimerComplete = useCallback(() => {
    if (onComplete) onComplete();
  }, [onComplete]);

  return {
    initialSeconds,
    expirySeconds: OTP_EXPIRY_SECONDS,
    cooldownSeconds: RESEND_COOLDOWN_SECONDS,
    onTimerComplete: handleTimerComplete,
  };
}

/**
 * Validate phone number format (Indian and International)
 * @param {string} phone - Phone number to validate
 * @returns {Object} Validation result
 */
export function validatePhone(phone) {
  if (!phone || phone.trim() === '') {
    return { valid: false, message: 'Phone number is required' };
  }

  // Remove common formatting
  const phoneDigits = phone.replace(/\D/g, '');

  // Validate Indian phone numbers (starting with 6-9, 10 digits)
  if (phoneDigits.length === 10 && /^[6-9]/.test(phoneDigits)) {
    return { valid: true, message: '' };
  }

  // Validate international numbers (10-15 digits)
  if (phoneDigits.length >= 10 && phoneDigits.length <= 15) {
    return { valid: true, message: '' };
  }

  return { 
    valid: false, 
    message: 'Invalid phone number. Enter 10-digit Indian number or international format.' 
  };
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Password strength analysis
 */
export function validatePassword(password) {
  if (!password) {
    return {
      valid: false,
      strength: { checks: {}, passed: 0, total: 1 },
      message: 'Password is required',
    };
  }

  const checks = {
    length: password.length >= 5,
  };
  
  const passed = Object.values(checks).filter(Boolean).length;
  const isValid = passed === 1;

  return {
    valid: isValid,
    strength: { checks, passed, total: 1 },
    message: isValid ? '' : 'Password must be at least 5 characters',
  };
}

/**
 * Format seconds into MM:SS
 * @param {number} secs - Seconds to format
 * @returns {string} Formatted time string
 */
export function formatTime(secs) {
  const minutes = Math.floor(secs / 60);
  const seconds = secs % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get error message based on error type
 * @param {string} message - Error message from API
 * @param {string} context - Error context ('registration' | 'otp' | 'general')
 * @returns {string} User-friendly error message
 */
export function getErrorMessage(message, context = 'general') {
  const msg = message?.toLowerCase() || '';

  if (context === 'registration') {
    if (msg.includes('already') || msg.includes('exist')) {
      return 'An account with this email or username already exists. Please sign in.';
    }
    if (msg.includes('phone') || msg.includes('email')) {
      return message; // Use backend message as-is
    }
  }

  if (context === 'otp') {
    if (msg.includes('expired') || msg.includes('invalid')) {
      return 'Incorrect code. Please try again or request a new code.';
    }
    if (msg.includes('attempt')) {
      return message; // Use attempt count message
    }
    // Handle specific OTP delivery errors
    if (msg.includes('smtp') || msg.includes('email')) {
      return 'Failed to send email. Please check your email address or try SMS instead.';
    }
    if (msg.includes('sms')) {
      return 'Failed to send SMS message. Please try email instead or contact support.';
    }
    if (msg.includes('network') || msg.includes('timeout')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
  }

  // General error handling
  if (msg.includes('smtp') || msg.includes('connection')) {
    return 'Email service temporarily unavailable. Please try again later or contact support.';
  }
  if (msg.includes('sms') && msg.includes('not configured')) {
    return 'SMS OTP is not available. Please use email verification instead.';
  }
  if (msg.includes('network') || msg.includes('timeout')) {
    return 'Network error. Please check your connection and try again.';
  }
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  return message || 'Something went wrong. Please try again.';
}
