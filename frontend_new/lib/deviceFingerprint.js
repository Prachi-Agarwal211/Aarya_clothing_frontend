/**
 * Lightweight, deterministic device fingerprint for "trust this browser".
 *
 * The hash is intentionally weak — it's not anti-fraud. Its only job is to
 * let the backend skip the OTP step on a browser the user has already
 * verified. We mix in stable, low-entropy signals (UA, language, screen,
 * timezone, color depth) and sha256 the result.
 *
 * The fingerprint is cached in localStorage so cookie purges don't
 * accidentally break the trusted-device flow.
 */

const CACHE_KEY = 'aarya.device.fingerprint.v1';
const NAME_KEY = 'aarya.device.name.v1';

const sha256Hex = async (input) => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return null;
  }
  const buf = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const collectSignals = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return '';
  }
  const screen = window.screen || {};
  return [
    navigator.userAgent || '',
    navigator.language || '',
    (navigator.languages || []).join(','),
    screen.width || 0,
    screen.height || 0,
    screen.colorDepth || 0,
    Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || '',
    navigator.hardwareConcurrency || 0,
    navigator.platform || '',
  ].join('|');
};

const guessDeviceName = () => {
  if (typeof navigator === 'undefined') return 'Unknown device';
  const ua = navigator.userAgent || '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Macintosh/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
};

export const getDeviceName = () => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage?.getItem(NAME_KEY);
    if (cached) return cached;
    const name = guessDeviceName();
    window.localStorage?.setItem(NAME_KEY, name);
    return name;
  } catch (_) {
    return guessDeviceName();
  }
};

export const getDeviceFingerprint = async () => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage?.getItem(CACHE_KEY);
    if (cached && cached.length === 64) return cached;
    const signals = collectSignals();
    if (!signals) return null;
    const hash = await sha256Hex(signals);
    if (hash) {
      try {
        window.localStorage?.setItem(CACHE_KEY, hash);
      } catch (_) {
        /* private mode — best effort */
      }
    }
    return hash;
  } catch (_) {
    return null;
  }
};
