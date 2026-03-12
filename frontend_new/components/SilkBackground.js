'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';

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
  const [isMobile, setIsMobile] = useState(false);
  const isInitializedRef = useRef(false);

  // Adaptive frame rate based on device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Frame rate throttling - adaptive based on device
  const targetFPS = isMobile ? 24 : 30;
  const frameInterval = 1000 / targetFPS;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // On mobile, use CSS gradient for better performance
    if (isMobile && window.innerWidth < 640) {
      canvas.style.background = 'linear-gradient(135deg, #0B0608 0%, #1A0F14 25%, #473C73 50%, #7A2F57 75%, #8A4B66 100%)';
      return;
    }

    // Try WebGL2 first, fallback to WebGL1
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
      console.warn('WebGL not supported, falling back to CSS gradient');
      canvas.style.background = 'linear-gradient(135deg, #0B0608 0%, #1A0F14 25%, #473C73 50%, #7A2F57 75%, #8A4B66 100%)';
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
    const fragmentShaderSource = `
      precision highp float;
      
      varying vec2 v_uv;
      uniform float u_time;
      uniform vec2 u_resolution;
      
      // Noise function matching the original JavaScript noise()
      float noise(vec2 p) {
        float G = 2.71828;
        float rx = G * sin(G * p.x);
        float ry = G * sin(G * p.y);
        return fract(rx * ry * (1.0 + p.x));
      }
      
      void main() {
        vec2 uv = v_uv;
        
        // Time and speed - balanced for smooth, elegant animation
        float t = u_time * 0.0002;
        float speed = 0.006;
        float scale = 2.0;
        float noiseIntensity = 0.8;
        
        // Calculate UV in scaled space
        float u = uv.x * scale;
        float v = uv.y * scale;
        
        // Time offset
        float tOffset = speed * t * 1000.0;
        
        // Texture coordinates with wave distortion
        float tex_x = u;
        float tex_y = v + 0.03 * sin(8.0 * tex_x - tOffset);
        
        // Pattern calculation - exact match to original
        float pattern = 0.6 + 0.4 * sin(
          5.0 * (tex_x + tex_y +
            cos(3.0 * tex_x + 5.0 * tex_y) +
            0.02 * tOffset) +
          sin(20.0 * (tex_x + tex_y - 0.1 * tOffset))
        );
        
        // Noise contribution - using smooth noise instead of harsh noise
        float rnd = fract(sin(dot(uv * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
        float intensity = max(0.0, pattern - rnd / 15.0 * noiseIntensity);
        
        // Color palette - exact match from original
        vec3 colors[8];
        colors[0] = vec3(11.0, 6.0, 8.0) / 255.0;      // #0B0608
        colors[1] = vec3(26.0, 15.0, 20.0) / 255.0;    // #1A0F14
        colors[2] = vec3(194.0, 122.0, 78.0) / 255.0;  // #C27A4E
        colors[3] = vec3(216.0, 154.0, 108.0) / 255.0; // #D89A6C
        colors[4] = vec3(139.0, 69.0, 19.0) / 255.0;   // #8B4513
        colors[5] = vec3(122.0, 47.0, 87.0) / 255.0;   // #7A2F57
        colors[6] = vec3(138.0, 75.0, 102.0) / 255.0;  // #8A4B66
        colors[7] = vec3(71.0, 60.0, 115.0) / 255.0;   // #473C73
        
        // --- IMPROVED COLOR INTERPOLATION BLOCK ---
        // Color position calculation - smooth diagonal flow (original style)
        float colorPos = (sin(t * 4.0 + uv.x * 1.5 + uv.y * 1.0) + 1.0) * 0.5;

        vec3 color = vec3(0.0);
        
        // Iterate through the color palette to blend continuously
        for (int i = 0; i < 7; ++i) {
            float segmentStart = float(i) / 7.0;
            float segmentEnd = float(i + 1) / 7.0;

            if (colorPos >= segmentStart && colorPos <= segmentEnd) {
                float blendFactor = (colorPos - segmentStart) / (segmentEnd - segmentStart);
                color = mix(colors[i], colors[i+1], smoothstep(0.0, 1.0, blendFactor));
                break;
            }
        }
        // Handle edge cases for float precision
        if (colorPos > 6.0/7.0 && colorPos <= 1.0 + 0.0001) {
            float blendFactor = (colorPos - 6.0/7.0) * 7.0;
            color = mix(colors[6], colors[7], smoothstep(0.0, 1.0, blendFactor));
        } else if (colorPos < 0.0 + 0.0001) {
            color = colors[0];
        }
        // --- END IMPROVED COLOR INTERPOLATION BLOCK ---
        
        // Apply intensity (matching original: 0.75)
        color = color * intensity * 0.75;
        
        // Base gradient overlay - smooth multi-directional blend
        float gradientX = smoothstep(0.0, 1.0, uv.x);
        float gradientY = smoothstep(0.0, 1.0, uv.y);
        float gradientFactor = gradientX * 0.4 + gradientY * 0.6;
        
        vec3 gradientColor1 = vec3(0.043, 0.024, 0.031);
        vec3 gradientColor2 = vec3(0.102, 0.059, 0.078);
        vec3 gradientColor3 = vec3(0.278, 0.235, 0.451);
        vec3 gradientColor4 = vec3(0.478, 0.184, 0.341);
        
        vec3 gradientColor = mix(gradientColor1, gradientColor2, smoothstep(0.0, 0.33, gradientFactor));
        gradientColor = mix(gradientColor, gradientColor3, smoothstep(0.33, 0.66, gradientFactor));
        gradientColor = mix(gradientColor, gradientColor4, smoothstep(0.66, 1.0, gradientFactor));
        
        // Blend pattern with gradient
        color = mix(gradientColor, color, 0.7);
        
        // Radial overlay (matching original)
        vec2 center = vec2(0.4, 0.3);
        float dist = length(uv - center);
        float radialFade = smoothstep(0.8, 0.0, dist);
        color = mix(color, vec3(0.055, 0.035, 0.04), 0.1 * (1.0 - radialFade));
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile shader function
    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    // Create program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders, using CSS fallback');
      canvas.style.background = 'linear-gradient(135deg, #0B0608 0%, #1A0F14 25%, #473C73 50%, #7A2F57 75%, #8A4B66 100%)';
      return;
    }
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      canvas.style.background = 'linear-gradient(135deg, #0B0608 0%, #1A0F14 25%, #473C73 50%, #7A2F57 75%, #8A4B66 100%)';
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

    // Resize handler with debounce for performance
    let resizeTimeout;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
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

    // Animation loop with frame throttling
    startTimeRef.current = performance.now();
    
    function render(currentTime) {
      // Skip if paused (tab hidden)
      if (isPausedRef.current) {
        animationRef.current = requestAnimationFrame(render);
        return;
      }
      
      // Frame rate throttling for battery optimization
      const deltaTime = currentTime - lastFrameTimeRef.current;
      if (deltaTime < frameInterval) {
        animationRef.current = requestAnimationFrame(render);
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

    // Cleanup function
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('webglcontextlost', handleContextLost, false);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored, false);
      
      if (animationRef.current) {
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
  }, [isMobile, frameInterval]);

  return (
    <canvas 
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ 
        zIndex: 0, 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: '#0B0608',
        pointerEvents: 'none'
      }}
    />
  );
}
