/**
 * useAlertToast Hook
 * 
 * Provides a drop-in replacement for alert() using the Toast system.
 * This ensures consistent, professional error/success notifications
 * throughout the application.
 * 
 * Usage:
 *   const { showAlert } = useAlertToast();
 *   showAlert('Error', 'Something went wrong');
 */

'use client';

import { useToast } from '@/components/ui/Toast';

export function useAlertToast() {
  const toast = useToast();

  /**
   * Show an error toast (replaces alert() for errors)
   * @param {string} message - Error message to display
   */
  const showError = (message) => {
    toast.error('Error', message);
  };

  /**
   * Show a success toast
   * @param {string} message - Success message to display
   */
  const showSuccess = (message) => {
    toast.success('Success', message);
  };

  /**
   * Show a warning toast
   * @param {string} message - Warning message to display
   */
  const showWarning = (message) => {
    toast.warning('Warning', message);
  };

  /**
   * Show an info toast
   * @param {string} message - Info message to display
   */
  const showInfo = (message) => {
    toast.info('Info', message);
  };

  /**
   * Generic showAlert method that defaults to error type
   * This allows direct replacement of alert() calls
   * @param {string} message - Message to display
   */
  const showAlert = (message) => {
    showError(message);
  };

  return {
    showAlert,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };
}

export default useAlertToast;
