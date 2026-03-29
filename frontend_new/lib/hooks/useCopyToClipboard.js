'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for copying text to clipboard
 * @param {number} timeout - Time in ms to reset copied state (default: 2000ms)
 * @returns {{ copied: boolean, error: Error|null, copy: Function }} - Object with copied state, error, and copy function
 */
export function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const timeoutRef = useRef(null);

  const copy = useCallback(async (text) => {
    // Clear any existing timeout to prevent memory leaks
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setError(null);
      timeoutRef.current = setTimeout(() => setCopied(false), timeout);
      return true;
    } catch (err) {
      setError(err);
      setCopied(false);
      return false;
    }
  }, [timeout]);

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { copied, error, copy };
}

export default useCopyToClipboard;
