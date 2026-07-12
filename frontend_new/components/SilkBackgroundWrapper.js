'use client';

import React, { Suspense, Component } from 'react';

/**
 * SilkBackgroundWrapper — loads the heavy WebGL SilkBackground lazily on the
 * client.  Uses React.lazy (with an import().catch fallback) plus an ErrorBoundary
 * so a chunk-load failure or render crash never takes down the entire root layout.
 *
 * Why React.lazy instead of next/dynamic?
 *   next/dynamic with ssr:false can silently return `undefined` when the async
 *   chunk fails to load (webpack "call" TypeError).  React.lazy + catch gives
 *   us an explicit fallback path *inside* the component tree.
 */

/** CSS silk when WebGL chunk fails — still looks premium, never flat black */
function SilkCssFallback() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{
        zIndex: 0,
        background:
          'radial-gradient(ellipse 130% 90% at 15% 5%, rgba(61,90,128,0.55) 0%, transparent 52%),' +
          'radial-gradient(ellipse 110% 80% at 90% 80%, rgba(30,58,95,0.55) 0%, transparent 48%),' +
          'linear-gradient(155deg, #0B0D10 0%, #121820 22%, #1a2332 42%, #1E3A5F 68%, #2C4A7C 88%, #0D1118 100%)',
      }}
    />
  );
}

const LazySilk = React.lazy(() =>
  import('./SilkBackground').catch((err) => {
    console.error('[SilkBackground] chunk load failed — falling back to CSS gradient', err);
    return { default: SilkCssFallback };
  })
);

class SilkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error('[SilkBackground] render error — falling back', err);
  }
  render() {
    if (this.state.hasError) return <SilkCssFallback />;
    return this.props.children;
  }
}

export default function SilkBackgroundWrapper() {
  return (
    <SilkErrorBoundary>
      <Suspense fallback={<SilkCssFallback />}>
        <LazySilk />
      </Suspense>
    </SilkErrorBoundary>
  );
}
