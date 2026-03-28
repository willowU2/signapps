'use client';

import { useEffect } from 'react';

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Dyslexia
    if (localStorage.getItem('signapps-dyslexia-font') === 'true') {
      document.documentElement.classList.add('dyslexia-font');
    }
    
    // Reduce Motion
    if (localStorage.getItem('signapps-reduce-motion') === 'true') {
      document.documentElement.classList.add('reduce-motion');
    }
    
    // Enhanced Cursor
    if (localStorage.getItem('signapps-enhanced-cursor') === 'true') {
      document.body.classList.add('enhanced-cursor');
    }

    // High Contrast Focus
    if (localStorage.getItem('signapps-high-contrast-focus') === 'true') {
      document.body.classList.add('high-contrast-focus');
    }

    // Comfortable Reading
    const lh = localStorage.getItem('signapps-a11y-line-height');
    const ls = localStorage.getItem('signapps-a11y-letter-spacing');
    const ws = localStorage.getItem('signapps-a11y-word-spacing');
    if (lh) document.documentElement.style.setProperty('--a11y-line-height', lh);
    if (ls) document.documentElement.style.setProperty('--a11y-letter-spacing', ls);
    if (ws) document.documentElement.style.setProperty('--a11y-word-spacing', ws);

    // Color Blindness
    const filterType = localStorage.getItem('signapps-color-blindness-filter');
    if (filterType && filterType !== 'none') {
      document.body.style.filter = `url(#${filterType})`;
    }
  }, []);

  return (
    <>
      <svg style={{ height: 0, width: 0, position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id="protanopia">
            <feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0" />
          </filter>
          <filter id="deuteranopia">
            <feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0" />
          </filter>
          <filter id="tritanopia">
            <feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" />
          </filter>
        </defs>
      </svg>
      {children}
    </>
  );
}
