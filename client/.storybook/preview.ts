import type { Preview } from '@storybook/react';

// Import global styles so components render correctly
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    // Enable background switching (light / dark)
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0a0a0a' },
      ],
    },

    // Viewport presets
    viewport: {
      viewports: {
        mobile: { name: 'Mobile (375)', styles: { width: '375px', height: '812px' } },
        tablet: { name: 'Tablet (768)', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop (1440)', styles: { width: '1440px', height: '900px' } },
      },
      defaultViewport: 'desktop',
    },

    // Apply Tailwind dark class on dark background
    darkMode: {
      classTarget: 'html',
      darkClass: 'dark',
      lightClass: 'light',
      stylePreview: true,
    },

    // Controls panel defaults
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
