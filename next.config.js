/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  cacheMaxMemorySize: 52 * 1024 * 1024,
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
