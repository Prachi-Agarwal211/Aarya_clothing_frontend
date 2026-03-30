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

        const handleMouseMove = (e) => {
            const rect = button.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Calculate distance from center (magnetic pull strength)
            // 0.3 determines how far the button follows the cursor
            xTarget = (e.clientX - centerX) * 0.3;
            yTarget = (e.clientY - centerY) * 0.3;
        };

        const handleMouseLeave = () => {
            xTarget = 0;
            yTarget = 0;
        };

        // Animation loop for smooth magnetic effect
        const animate = () => {
            // Linear interpolation for smooth spring-like effect
            proxy.x += (xTarget - proxy.x) * 0.1;
            proxy.y += (yTarget - proxy.y) * 0.1;

            gsap.set(button, { x: proxy.x, y: proxy.y });

            requestAnimationFrame(animate);
        };

        animate();

        button.addEventListener('mousemove', handleMouseMove);
        button.addEventListener('mouseleave', handleMouseLeave);

        return () => {
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
