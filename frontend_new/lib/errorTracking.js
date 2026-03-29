import logger from './logger';

/**
 * Error tracking utility for Sentry integration.
 */

let Sentry = null;

export function initErrorTracking() {
  if (typeof window === 'undefined') return;
  
  // Only initialize in production
  if (process.env.NODE_ENV !== 'production') return;
  
  // Dynamic import to reduce bundle size
  import('@sentry/nextjs').then(sentry => {
    Sentry = sentry;
    
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      integrations: [
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
    });
  });
}

export function captureError(error, context = {}) {
  logger.error('Error captured:', error, context);
  
  if (Sentry) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

export function captureMessage(message, level = 'info') {
  if (Sentry) {
    Sentry.captureMessage(message, level);
  }
}

export function setUserContext(user) {
  if (Sentry && user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }
}

export function clearUserContext() {
  if (Sentry) {
    Sentry.setUser(null);
  }
}
