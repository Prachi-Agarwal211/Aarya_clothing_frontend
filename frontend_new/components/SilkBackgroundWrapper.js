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

const LazySilk = React.lazy(() =>
  import('./SilkBackground').catch((err) => {
    // Chunk failed to load (network error, large bundle, etc.)
    console.error('[SilkBackground] chunk load failed — falling back to CSS gradient', err);
    return { default: () => null };
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
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function SilkBackgroundWrapper() {
  return (
    <SilkErrorBoundary>
      <Suspense fallback={null}>
        <LazySilk />
      </Suspense>
    </SilkErrorBoundary>
  );
}
