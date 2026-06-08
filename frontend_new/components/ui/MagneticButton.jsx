'use client';

import React, { useRef, useEffect } from 'react';
import { gsap } from '@/lib/gsapConfig';

export function MagneticButton({ children, className, onClick, ...props }) {
    const buttonRef = useRef(null);

    useEffect(() => {
        const button = buttonRef.current;
        if (!button) return;

        let proxy = { x: 0, y: 0 };
        let xTarget = 0;
        let yTarget = 0;
        let rafId = null;
        let isAnimating = false;

        const handleMouseMove = (e) => {
            const rect = button.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            xTarget = (e.clientX - centerX) * 0.3;
            yTarget = (e.clientY - centerY) * 0.3;

            // Start rAF loop only when mouse is near the button
            if (!isAnimating) {
                isAnimating = true;
                animate();
            }
        };

        const handleMouseLeave = () => {
            xTarget = 0;
            yTarget = 0;
            // Let the loop settle back to 0, then stop
        };

        // Animation loop — stops when settled
        const animate = () => {
            proxy.x += (xTarget - proxy.x) * 0.1;
            proxy.y += (yTarget - proxy.y) * 0.1;

            gsap.set(button, { x: proxy.x, y: proxy.y });

            // Stop the loop when settled (both target and position near 0)
            if (Math.abs(proxy.x) < 0.01 && Math.abs(proxy.y) < 0.01 &&
                Math.abs(xTarget) < 0.01 && Math.abs(yTarget) < 0.01) {
                isAnimating = false;
                gsap.set(button, { x: 0, y: 0 });
                return;
            }
            rafId = requestAnimationFrame(animate);
        };

        button.addEventListener('mousemove', handleMouseMove);
        button.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            isAnimating = false;
            button.removeEventListener('mousemove', handleMouseMove);
            button.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, []);

    return (
        <div
            ref={buttonRef}
            onClick={onClick}
            className={`inline-block w-fit ${className || ''}`}
            {...props}
        >
            {children}
        </div>
    );
}
