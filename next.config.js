const path = require('path');
const { version } = require('./package.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },

  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
