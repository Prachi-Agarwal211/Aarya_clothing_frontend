// Dev config: keep image optimization enabled but with relaxed settings for faster dev builds.
const baseConfig = require('./next.config.js');

module.exports = {
  ...baseConfig,
  images: {
    ...baseConfig.images,
    // Keep optimization enabled in dev to match production behavior
    minimumCacheTTL: 60,
  },
  // Faster dev HMR
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};
