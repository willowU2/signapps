module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/login',
        'http://localhost:3000/mail',
        'http://localhost:3000/dashboard',
      ],
      numberOfRuns: 3,
      settings: {
        // Skip PWA checks as SignApps is not a PWA
        skipAudits: ['installable-manifest', 'service-worker', 'splash-screen', 'themed-omnibox'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.7 }],
        'categories:accessibility': ['error', { minScore: 0.8 }],
        'categories:best-practices': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.7 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
