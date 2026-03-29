'use client';

import { useEffect } from 'react';
import { initWebVitals, observePerformance } from '../lib/webVitals';

export default function WebVitalsInit() {
  useEffect(() => {
    initWebVitals();
    observePerformance();
  }, []);

  return null;
}
