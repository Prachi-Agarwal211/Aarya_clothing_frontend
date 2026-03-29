/**
 * Cashfree SDK Loader
 * Dynamically loads Cashfree checkout SDK v3
 * 
 * Usage:
 *   import { initializeCashfree } from '@/lib/cashfree';
 *   const cashfree = await initializeCashfree('production');
 *   await cashfree.checkout({ paymentSessionId, returnUrl });
 */

let cashfreePromise = null;

/**
 * Load Cashfree SDK script dynamically
 * @returns {Promise<any>} Resolves with Cashfree constructor
 */
export function loadCashfreeSDK() {
  if (cashfreePromise) {
    return cashfreePromise;
  }

  cashfreePromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.Cashfree) {
      resolve(window.Cashfree);
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree);
      } else {
        reject(new Error('Cashfree SDK loaded but Cashfree object not found'));
      }
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load Cashfree SDK script. Please check your internet connection or disable ad blockers.'));
    };
    
    document.body.appendChild(script);
  });

  return cashfreePromise;
}

/**
 * Initialize Cashfree with mode (production or sandbox)
 * @param {string} mode - 'production' or 'sandbox'
 * @returns {Promise<any>} Resolves with initialized Cashfree instance
 */
export async function initializeCashfree(mode = 'production') {
  try {
    const Cashfree = await loadCashfreeSDK();
    const cashfree = Cashfree({ mode });
    return cashfree;
  } catch (error) {
    console.error('Failed to initialize Cashfree:', error);
    throw error;
  }
}

/**
 * Check if Cashfree SDK is loaded
 * @returns {boolean}
 */
export function isCashfreeLoaded() {
  return typeof window !== 'undefined' && !!window.Cashfree;
}

/**
 * Reset SDK loader (useful for testing or re-initialization)
 */
export function resetCashfreeLoader() {
  cashfreePromise = null;
}
