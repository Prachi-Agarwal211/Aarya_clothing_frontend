'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const ParallaxContainer = ({ 
  children, 
  speed = 0.5, 
  className,
  id 
}) => {
  const triggerRef = useRef(null);
  const targetRef = useRef(null);
  const scrollTriggerRef = useRef(null);

  useEffect(() => {
    const element = targetRef.current;
    const trigger = triggerRef.current;

    if (!element || !trigger) return;

    // Create specific ScrollTrigger and store reference
    scrollTriggerRef.current = gsap.fromTo(element, 
      {
        y: 0
      },
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

    // Only kill THIS specific ScrollTrigger instance
    return () => {
      if (scrollTriggerRef.current) {
        scrollTriggerRef.current.kill();
      }
    };
  }, [speed]);

  return (
    <div ref={triggerRef} id={id} className={`relative overflow-hidden ${className}`}>
      <div ref={targetRef} className="will-change-transform">
        {children}
      </div>
    </div>
  );
};

export default ParallaxContainer;
