'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsapConfig';

const ParallaxContainer = ({ 
  children, 
  speed = 0.5, 
  className,
  id 
}) => {
  const triggerRef = useRef(null);
  const targetRef = useRef(null);

  useEffect(() => {
    const element = targetRef.current;
    const trigger = triggerRef.current;

    if (!element || !trigger) return;

    // Use gsap.context for reliable cleanup of all GSAP animations + ScrollTriggers
    const ctx = gsap.context(() => {
      gsap.fromTo(element, 
        { y: 0 },
        {
          y: () => -(trigger.offsetHeight * speed),
          ease: "none",
          scrollTrigger: {
            trigger: trigger,
            start: "top bottom",
            end: "bottom top",
            scrub: 0
          }
        }
      );
    });

    return () => ctx.revert();
  }, [speed]);

  return (
    <div ref={triggerRef} id={id} className={`relative overflow-hidden ${className}`}>
      <div ref={targetRef}>
        {children}
      </div>
    </div>
  );
};

export default ParallaxContainer;
