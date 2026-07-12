'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import logger from '@/lib/logger';

/**
 * SilkBackground - WebGL-based animated gradient background
 * 
 * Converted from Canvas 2D to WebGL for GPU-accelerated rendering.
 * Uses GLSL shaders to replicate the exact silk-like flowing effect.
 * 
 * Features:
 * - WebGL2 with fallback to WebGL1
 * - GPU-based noise and pattern generation
 * - Exact color palette match with original
 * - Adaptive frame rate based on device capability
 * - Mobile-optimized with reduced complexity
 * - Visibility API - pauses when tab is hidden
 * - WebGL context loss handling
 * - Proper cleanup on unmount
 */
// Grayish metal-royal silk (steel blue, not purple/neon)
// #0D0D0D → #1a2332 → #1E3A5F → #2C4A7C → steel #5a6f8a
const STATIC_GRADIENT =
  'radial-gradient(ellipse 130% 90% at 15% 5%, rgba(61,90,128,0.55) 0%, transparent 52%),' +
  'radial-gradient(ellipse 110% 80% at 90% 80%, rgba(30,58,95,0.55) 0%, transparent 48%),' +
  'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(90,111,138,0.12) 0%, transparent 60%),' +
  'linear-gradient(155deg, #0B0D10 0%, #121820 22%, #1a2332 42%, #1E3A5F 68%, #2C4A7C 88%, #0D1118 100%)';

/** Admin: flat matte so dashboards stay crisp (no competing silk) */
const ADMIN_GRADIENT =
  'linear-gradient(180deg, #0B0D10 0%, #111418 50%, #0D0D0D 100%)';

export default function SilkBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const positionBufferRef = useRef(null);
  const vertexShaderRef = useRef(null);
  const fragmentShaderRef = useRef(null);
  const isPausedRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  const isMobileRef = useRef(false);         // ref — no re-init on resize
  const isInitializedRef = useRef(false);
  const cleanupRef = useRef(null);

  const pathname = usePathname();
  // Full silk animation on storefront. Static only on heavy admin dashboards.
  // Auth/checkout keep a subtle static silk (not flat black) for brand continuity.
  const shouldAnimate = !pathname?.startsWith('/admin');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Always paint a rich CSS base immediately (avoids black flash before WebGL)
    canvas.style.background = shouldAnimate ? STATIC_GRADIENT : ADMIN_GRADIENT;

    // Static matte for admin — clear UI, no animated silk competing with tables
    if (!shouldAnimate) {
      return;
    }

    // prefers-reduced-motion: static gradient, no animation
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Phones: keep rich static silk (battery). Tablets/laptops (≥768) get WebGL.
    isMobileRef.current =
      window.innerWidth < 768 ||
      /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // iPad-class often reports as mobile UA but is large — still animate if wide
    const isDesktopWidth = window.innerWidth >= 768;
    if (isMobileRef.current && !isDesktopWidth) {
      return;
    }
    isMobileRef.current = false; // force full desktop shader on laptop+

    // Desktop / laptop: full WebGL silk at 30fps
    const frameInterval = 1000 / 30;
    const maxDimension = 1920;

    // PERFORMANCE: Defer WebGL initialization until browser is idle
    // This prioritizes the initial page paint (Hero, Text, Products)
    let idleHandle;
    const initWebGL = () => {
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        powerPreference: 'low-power'
      }) || canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        powerPreference: 'low-power'
      });
      
      if (!gl) {
        logger.warn('WebGL not supported, falling back to CSS gradient');
        canvas.style.background = STATIC_GRADIENT;
        return;
      }
      glRef.current = gl;

      // Vertex shader - simple full-screen quad
      const vertexShaderSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        
        void main() {
          v_uv = a_position * 0.5 + 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
        }
      `;

      // Fragment shader - replicates the exact silk effect from original Canvas 2D code
      // PERFORMANCE: Mobile uses simplified shader pattern for better battery life
      const fragmentShaderSource = `
        precision highp float;

        varying vec2 v_uv;
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform float u_isMobile;

        // Noise function matching the original JavaScript noise()
        float noise(vec2 p) {
          float G = 2.71828;
          float rx = G * sin(G * p.x);
          float ry = G * sin(G * p.y);
          return fract(rx * ry * (1.0 + p.x));
        }

        void main() {
          vec2 uv = v_uv;

          // Grayish metal-royal flow (steel + royal blue, no purple)
          float t = u_time * 0.00026;
          float speed = 0.0085;
          float scale = 2.15;
          float noiseIntensity = 0.48;

          float u = uv.x * scale;
          float v = uv.y * scale;
          float tOffset = speed * t * 1000.0;

          float tex_x = u;
          float tex_y = v + 0.04 * sin(6.5 * tex_x - tOffset);

          float pattern = 0.52 + 0.48 * sin(
            4.8 * (tex_x + tex_y +
              cos(2.8 * tex_x + 4.6 * tex_y) +
              0.022 * tOffset) +
            sin(16.0 * (tex_x + tex_y - 0.1 * tOffset))
          );

          float rnd = fract(sin(dot(uv * 88.0, vec2(12.9898, 78.233))) * 43758.5453);
          float intensity = max(0.4, pattern - rnd / 20.0 * noiseIntensity);

          // Metal steel → royal blue palette (grayish cool blue)
          vec3 colors[8];
          colors[0] = vec3(11.0, 13.0, 16.0) / 255.0;      // near black
          colors[1] = vec3(22.0, 28.0, 38.0) / 255.0;      // graphite blue-grey
          colors[2] = vec3(32.0, 42.0, 58.0) / 255.0;      // metal slate
          colors[3] = vec3(30.0, 58.0, 95.0) / 255.0;      // #1E3A5F royal
          colors[4] = vec3(44.0, 74.0, 124.0) / 255.0;     // #2C4A7C mid royal
          colors[5] = vec3(74.0, 98.0, 130.0) / 255.0;     // steel blue-grey
          colors[6] = vec3(90.0, 111.0, 138.0) / 255.0;    // metal highlight
          colors[7] = vec3(26.0, 34.0, 48.0) / 255.0;      // deep metal

          float colorPos = (sin(t * 4.2 + uv.x * 1.6 + uv.y * 1.15) + 1.0) * 0.5;

          vec3 color = colors[0];
          for (int i = 0; i < 7; ++i) {
              float segmentStart = float(i) / 7.0;
              float segmentEnd = float(i + 1) / 7.0;
              if (colorPos >= segmentStart && colorPos <= segmentEnd) {
                  float blendFactor = (colorPos - segmentStart) / (segmentEnd - segmentStart);
                  color = mix(colors[i], colors[i+1], smoothstep(0.0, 1.0, blendFactor));
                  break;
              }
          }
          if (colorPos > 6.0/7.0) {
              float blendFactor = (colorPos - 6.0/7.0) * 7.0;
              color = mix(colors[6], colors[7], smoothstep(0.0, 1.0, blendFactor));
          }

          color = color * intensity * 1.08;

          float gradientX = smoothstep(0.0, 1.0, uv.x);
          float gradientY = smoothstep(0.0, 1.0, uv.y);
          float gradientFactor = gradientX * 0.32 + gradientY * 0.68;

          // Cool metal wash
          vec3 gradientColor1 = vec3(0.04, 0.05, 0.07);
          vec3 gradientColor2 = vec3(0.08, 0.11, 0.16);
          vec3 gradientColor3 = vec3(0.12, 0.23, 0.37); // royal
          vec3 gradientColor4 = vec3(0.20, 0.29, 0.42); // steel blue

          vec3 gradientColor = mix(gradientColor1, gradientColor2, smoothstep(0.0, 0.33, gradientFactor));
          gradientColor = mix(gradientColor, gradientColor3, smoothstep(0.33, 0.66, gradientFactor));
          gradientColor = mix(gradientColor, gradientColor4, smoothstep(0.66, 1.0, gradientFactor));

          color = mix(gradientColor, color, 0.78);

          vec2 center = vec2(0.42, 0.32);
          float dist = length(uv - center);
          float radialFade = smoothstep(1.0, 0.0, dist);
          color = mix(color, vec3(0.03, 0.04, 0.06), 0.14 * (1.0 - radialFade));

          gl_FragColor = vec4(color, 1.0);
        }
      `;

      // Compile shader function
      function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          logger.error('Shader compile error:', gl.getShaderInfoLog(shader));
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      }

      // Create program
      const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
      const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
      
      if (!vertexShader || !fragmentShader) {
        logger.error('Failed to create shaders, using CSS fallback');
        canvas.style.background = STATIC_GRADIENT;
        return;
      }
      
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        logger.error('Program link error:', gl.getProgramInfoLog(program));
        canvas.style.background = STATIC_GRADIENT;
        return;
      }
      
      programRef.current = program;

      // Set up geometry (full-screen quad)
      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]), gl.STATIC_DRAW);
      positionBufferRef.current = positionBuffer;

      const positionLocation = gl.getAttribLocation(program, 'a_position');
      const timeLocation = gl.getUniformLocation(program, 'u_time');
      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      // PERFORMANCE: Uniform for mobile detection in shader
      const isMobileLocation = gl.getUniformLocation(program, 'u_isMobile');

      // Resize handler with debounce for performance
      let resizeTimeout;
      function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        // PERFORMANCE: Cap resolution for mobile to reduce GPU load
        const width = Math.min(window.innerWidth * dpr, maxDimension);
        const height = Math.min(window.innerHeight * dpr, maxDimension);
        
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      
      function debouncedResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resize, 100);
      }
      
      resize();
      window.addEventListener('resize', debouncedResize, { passive: true });

      // Animation loop with battery-efficient frame throttling
      startTimeRef.current = performance.now();

      function render(currentTime) {
        if (isPausedRef.current) {
          animationRef.current = requestAnimationFrame(render);
          return;
        }

        const deltaTime = currentTime - lastFrameTimeRef.current;
        if (deltaTime < frameInterval) {
          // Use setTimeout to avoid waking up 60x/sec just to check the clock
          const delay = Math.max(0, frameInterval - deltaTime);
          animationRef.current = setTimeout(() => {
            animationRef.current = requestAnimationFrame(render);
          }, delay);
          return;
        }
        lastFrameTimeRef.current = currentTime - (deltaTime % frameInterval);
        
        const gl = glRef.current;
        const program = programRef.current;
        
        if (!gl || !program) return;
        
        gl.useProgram(program);
        
        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        
        const elapsed = currentTime - startTimeRef.current;
        gl.uniform1f(timeLocation, elapsed);
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
        // PERFORMANCE: Pass mobile flag to shader for simplified pattern
        gl.uniform1f(isMobileLocation, isMobileRef.current ? 1.0 : 0.0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        animationRef.current = requestAnimationFrame(render);
      }

      // Visibility API - pause when tab is hidden (battery optimization)
      function handleVisibilityChange() {
        isPausedRef.current = document.hidden;
        if (!document.hidden) {
          // Reset frame timing when resuming
          lastFrameTimeRef.current = performance.now();
        }
      }
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // WebGL context loss handling - critical for mobile/stability
      function handleContextLost(event) {
        event.preventDefault();
        isPausedRef.current = true;
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
      }

      function handleContextRestored() {
        isPausedRef.current = false;
        isInitializedRef.current = false;
        // Reinitialize will happen via useEffect
        startTimeRef.current = performance.now();
        lastFrameTimeRef.current = 0;
        render(performance.now());
      }

      canvas.addEventListener('webglcontextlost', handleContextLost, false);
      canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

      // Store shader refs for cleanup
      vertexShaderRef.current = vertexShader;
      fragmentShaderRef.current = fragmentShader;
      isInitializedRef.current = true;

      render(performance.now());

      // Store cleanup function in ref (not window) for proper unmount handling
      cleanupRef.current = () => {
        clearTimeout(resizeTimeout);
        window.removeEventListener('resize', debouncedResize);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        canvas.removeEventListener('webglcontextlost', handleContextLost, false);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored, false);
      };
    };

    // Use requestIdleCallback for init, with 2s timeout fallback
    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(() => initWebGL(), { timeout: 2000 });
    } else {
      idleHandle = setTimeout(initWebGL, 1000);
    }

    // Cleanup function
    return () => {
      if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }

      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }

      if (animationRef.current) {
        clearTimeout(animationRef.current);
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      const gl = glRef.current;
      if (gl) {
        if (programRef.current) {
          gl.deleteProgram(programRef.current);
          programRef.current = null;
        }
        if (vertexShaderRef.current) {
          gl.deleteShader(vertexShaderRef.current);
          vertexShaderRef.current = null;
        }
        if (fragmentShaderRef.current) {
          gl.deleteShader(fragmentShaderRef.current);
          fragmentShaderRef.current = null;
        }
        if (positionBufferRef.current) {
          gl.deleteBuffer(positionBufferRef.current);
          positionBufferRef.current = null;
        }
      }
      
      isInitializedRef.current = false;
    };
  }, [shouldAnimate]); // re-run only when route changes between animated/static

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      aria-hidden="true"
      style={{
        zIndex: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        // Rich base so laptop never sees flat pure black before WebGL starts
        background: STATIC_GRADIENT,
        pointerEvents: 'none',
      }}
    />
  );
}
