import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  // Discover stories co-located with components
  stories: ['../src/**/*.stories.@(ts|tsx)'],

  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],

  framework: {
    name: '@storybook/nextjs',
    options: {},
  },

  // Re-use the Next.js tsconfig paths (@/ alias)
  typescript: {
    check: false,
    reactDocgen: 'react-docgen-typescript',
  },

  // Expose static files from the public directory
  staticDirs: ['../public'],

  docs: {
    autodocs: 'tag',
  },
};

export default config;
