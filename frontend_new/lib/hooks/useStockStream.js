/**
 * Hook for real-time stock updates via Server-Sent Events (SSE)
 * Connects to /api/v1/cart/stock-stream for live stock updates
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCommerceBaseUrl } from '@/lib/baseApi';

export function useStockStream(enabled = true) {
  const [stockUpdates, setStockUpdates] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 5000; // 5 seconds

  const getReconnectDelay = useCallback(() => {
    // Exponential backoff: 5s, 10s, 20s, 40s, 80s
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current);
    return Math.min(delay, 60000); // Cap at 60 seconds
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (eventSourceRef.current) return; // Already connected

    try {
      // Properly construct SSE URL using URL API
      const baseUrl = getCommerceBaseUrl();
      const url = new URL('/api/v1/cart/stock-stream', baseUrl).toString();
      
      // SECURITY: Token is passed via headers using native EventSource with custom headers
      // This requires the server to support header-based auth for SSE
      // Alternative: Use a session cookie that's automatically sent with the request
      const es = new EventSource(url, {
        withCredentials: true, // Sends cookies automatically
      });
      
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptRef.current = 0; // Reset reconnect counter on successful connection
        console.log('[StockStream] Connected');
      };

      es.onmessage = (event) => {
        if (event.data.startsWith(':keepalive')) return;
        
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'stock_update') {
            setStockUpdates(data.items || []);
          } else if (data.type === 'error') {
            setError(data.message);
          }
        } catch (err) {
          console.error('[StockStream] Parse error:', err);
        }
      };

      es.onerror = (err) => {
        console.error('[StockStream] Error:', err);
        setError('Connection error');
        setIsConnected(false);
        
        // Don't auto-reconnect if we've exceeded max attempts
        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.error('[StockStream] Max reconnect attempts reached. Giving up.');
          setError('Connection failed after multiple attempts. Please refresh the page.');
          return;
        }
        
        // Clear current connection
        if (eventSourceRef.current === es) {
          eventSourceRef.current = null;
        }
        
        // Exponential backoff reconnect
        const delay = getReconnectDelay();
        reconnectAttemptRef.current += 1;
        
        console.log(`[StockStream] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
        
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

    } catch (err) {
      setError(err.message);
      console.error('[StockStream] Failed to connect:', err);
    }
  }, [getReconnectDelay]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      console.log('[StockStream] Disconnected');
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // Check if a specific product/variant is in stock
  const checkStock = useCallback((productId, variantId, requestedQuantity = 1) => {
    const item = stockUpdates.find(
      u => u.product_id === productId && u.variant_id === variantId
    );
    
    if (!item) return { inStock: true, available: null }; // Unknown, assume in stock
    
    return {
      inStock: item.in_stock && item.available_quantity >= requestedQuantity,
      available: item.available_quantity,
      requested: requestedQuantity
    };
  }, [stockUpdates]);

  return {
    stockUpdates,
    isConnected,
    error,
    checkStock,
    connect,
    disconnect
  };
}
